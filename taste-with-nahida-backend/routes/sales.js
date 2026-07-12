const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getProductCost } = require('../utils');

const router = express.Router();
router.use(requireAuth); // business data — admin only

// Log a sale — snapshots the current cost-to-make so past profit stays accurate
// even if ingredient prices change later. Also deducts the ingredients used from stock.
router.post('/', async (req, res, next) => {
  try {
    const { product_id, quantity_sold, sale_price_per_unit, sale_date, notes } = req.body;
    if (!product_id || !quantity_sold || sale_price_per_unit === undefined) {
      return res.status(400).json({ error: 'product_id, quantity_sold, and sale_price_per_unit are required' });
    }

    const product = await db.get('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const costPerUnit = await getProductCost(db, product_id);
    const profitTotal = (sale_price_per_unit - costPerUnit) * quantity_sold;

    // Figure out exactly how much of each ingredient this sale consumes,
    // snapshot it on the sale record, deduct it from stock, and flag anything
    // that goes at or below zero so the dashboard can warn about it.
    const productIngredients = await db.all(
      'SELECT ingredient_id, quantity FROM product_ingredients WHERE product_id = ?',
      [product_id]
    );
    const stockWarnings = [];
    const snapshot = [];
    for (const pi of productIngredients) {
      const usedQty = pi.quantity * quantity_sold;
      snapshot.push({ ingredient_id: pi.ingredient_id, quantity: usedQty });
      const ingredient = await db.get('SELECT * FROM ingredients WHERE id = ?', [pi.ingredient_id]);
      if (ingredient) {
        const newStock = ingredient.current_stock - usedQty;
        await db.run('UPDATE ingredients SET current_stock = ? WHERE id = ?', [newStock, pi.ingredient_id]);
        if (newStock <= 0) {
          stockWarnings.push({ name: ingredient.name, remaining: newStock, unit: ingredient.unit });
        }
      }
    }

    const info = await db.run(
      `INSERT INTO sales (product_id, product_name, quantity_sold, sale_price_per_unit, cost_per_unit_snapshot, profit_total, sale_date, notes, ingredients_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [product_id, product.name, quantity_sold, sale_price_per_unit, costPerUnit, profitTotal, sale_date || new Date().toISOString().slice(0, 10), notes || '', JSON.stringify(snapshot)]
    );

    const row = await db.get('SELECT * FROM sales WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json({ ...row, stockWarnings });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM sales ORDER BY sale_date DESC, created_at DESC');
    res.json(rows);
  } catch (err) { next(err); }
});

// Summary — totals overall and broken down by product
router.get('/summary', async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM sales');

    const totals = rows.reduce((acc, r) => {
      acc.revenue += r.quantity_sold * r.sale_price_per_unit;
      acc.cost += r.quantity_sold * r.cost_per_unit_snapshot;
      acc.profit += r.profit_total;
      acc.units += r.quantity_sold;
      return acc;
    }, { revenue: 0, cost: 0, profit: 0, units: 0 });

    const byProduct = {};
    for (const r of rows) {
      if (!byProduct[r.product_name]) {
        byProduct[r.product_name] = { product_name: r.product_name, units: 0, revenue: 0, cost: 0, profit: 0 };
      }
      const p = byProduct[r.product_name];
      p.units += r.quantity_sold;
      p.revenue += r.quantity_sold * r.sale_price_per_unit;
      p.cost += r.quantity_sold * r.cost_per_unit_snapshot;
      p.profit += r.profit_total;
    }

    res.json({ totals, byProduct: Object.values(byProduct).sort((a, b) => b.profit - a.profit) });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const sale = await db.get('SELECT * FROM sales WHERE id = ?', [req.params.id]);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    // Give back whatever stock this sale had consumed
    if (sale.ingredients_snapshot) {
      try {
        const snapshot = JSON.parse(sale.ingredients_snapshot);
        for (const item of snapshot) {
          await db.run('UPDATE ingredients SET current_stock = current_stock + ? WHERE id = ?', [item.quantity, item.ingredient_id]);
        }
      } catch (e) { /* malformed/older snapshot — nothing to restore, safe to skip */ }
    }

    await db.run('DELETE FROM sales WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// List of years that have at least one sale — used to populate the report's year picker
router.get('/years', async (req, res, next) => {
  try {
    const rows = await db.all('SELECT sale_date FROM sales');
    const years = [...new Set(rows.map(r => r.sale_date.slice(0, 4)))].sort((a, b) => b - a);
    const currentYear = String(new Date().getFullYear());
    if (!years.includes(currentYear)) years.unshift(currentYear);
    res.json(years);
  } catch (err) { next(err); }
});

// Month-by-month breakdown for a given year, plus the end-of-year total
router.get('/monthly', async (req, res, next) => {
  try {
    const year = String(req.query.year || new Date().getFullYear());
    const rows = await db.all('SELECT * FROM sales WHERE sale_date LIKE ?', [`${year}-%`]);

    const months = MONTH_NAMES.map((name, idx) => {
      const monthNum = String(idx + 1).padStart(2, '0');
      const monthRows = rows.filter(r => r.sale_date.slice(5, 7) === monthNum);
      const revenue = monthRows.reduce((s, r) => s + r.quantity_sold * r.sale_price_per_unit, 0);
      const cost = monthRows.reduce((s, r) => s + r.quantity_sold * r.cost_per_unit_snapshot, 0);
      const profit = monthRows.reduce((s, r) => s + r.profit_total, 0);
      const units = monthRows.reduce((s, r) => s + r.quantity_sold, 0);
      return { month: idx + 1, name, revenue, cost, profit, units, saleCount: monthRows.length };
    });

    const yearTotal = months.reduce((acc, m) => ({
      revenue: acc.revenue + m.revenue,
      cost: acc.cost + m.cost,
      profit: acc.profit + m.profit,
      units: acc.units + m.units
    }), { revenue: 0, cost: 0, profit: 0, units: 0 });

    res.json({ year, months, yearTotal });
  } catch (err) { next(err); }
});

module.exports = router;
