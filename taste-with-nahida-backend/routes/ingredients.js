const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All ingredient routes are admin-only — this is business data, not public content.
router.use(requireAuth);

function withStockValue(row) {
  return { ...row, stock_value: row.current_stock * row.cost_per_unit };
}

router.get('/', async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM ingredients ORDER BY name ASC');
    res.json(rows.map(withStockValue));
  } catch (err) { next(err); }
});

// Opening/manual entry — creates the ingredient with a starting stock and cost.
// Ongoing cost updates should normally happen through logging a purchase instead.
router.post('/', async (req, res, next) => {
  try {
    const { name, unit, cost_per_unit, current_stock, purchase_unit, purchase_ratio } = req.body;
    if (!name || !unit || cost_per_unit === undefined) {
      return res.status(400).json({ error: 'name, unit, and cost_per_unit are required' });
    }
    const info = await db.run(
      'INSERT INTO ingredients (name, unit, cost_per_unit, current_stock, purchase_unit, purchase_ratio) VALUES (?, ?, ?, ?, ?, ?)',
      [name, unit, cost_per_unit, current_stock || 0, purchase_unit || unit, purchase_ratio || 1]
    );
    const row = await db.get('SELECT * FROM ingredients WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json(withStockValue(row));
  } catch (err) { next(err); }
});

// Manual correction only (name/unit, or a manual stock/cost override if needed).
// Prefer logging a purchase (routes/purchases.js) for normal restocking.
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await db.get('SELECT * FROM ingredients WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Ingredient not found' });

    const { name, unit, cost_per_unit, current_stock, purchase_unit, purchase_ratio } = req.body;
    await db.run(
      `UPDATE ingredients SET name = ?, unit = ?, cost_per_unit = ?, current_stock = ?, purchase_unit = ?, purchase_ratio = ?, updated_at = datetime('now') WHERE id = ?`,
      [
        name ?? existing.name,
        unit ?? existing.unit,
        cost_per_unit ?? existing.cost_per_unit,
        current_stock ?? existing.current_stock,
        purchase_unit ?? existing.purchase_unit,
        purchase_ratio ?? existing.purchase_ratio,
        req.params.id
      ]
    );
    const row = await db.get('SELECT * FROM ingredients WHERE id = ?', [req.params.id]);
    res.json(withStockValue(row));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const inUse = await db.get('SELECT id FROM product_ingredients WHERE ingredient_id = ?', [req.params.id]);
    if (inUse) {
      return res.status(400).json({ error: 'This ingredient is used in a product — remove it from that product first.' });
    }
    const info = await db.run('DELETE FROM ingredients WHERE id = ?', [req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Ingredient not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
