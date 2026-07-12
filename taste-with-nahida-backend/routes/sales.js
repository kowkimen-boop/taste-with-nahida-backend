const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getProductCost } = require('../utils');

const router = express.Router();
router.use(requireAuth); // business data — admin only

// Log a sale — snapshots the current cost-to-make so past profit stays accurate
// even if ingredient prices change later.
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

    const info = await db.run(
      `INSERT INTO sales (product_id, product_name, quantity_sold, sale_price_per_unit, cost_per_unit_snapshot, profit_total, sale_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [product_id, product.name, quantity_sold, sale_price_per_unit, costPerUnit, profitTotal, sale_date || new Date().toISOString().slice(0, 10), notes || '']
    );

    const row = await db.get('SELECT * FROM sales WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json(row);
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
    const info = await db.run('DELETE FROM sales WHERE id = ?', [req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Sale not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
