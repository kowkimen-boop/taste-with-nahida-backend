const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All ingredient routes are admin-only — this is business data, not public content.
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM ingredients ORDER BY name ASC');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, unit, cost_per_unit } = req.body;
    if (!name || !unit || cost_per_unit === undefined) {
      return res.status(400).json({ error: 'name, unit, and cost_per_unit are required' });
    }
    const info = await db.run(
      'INSERT INTO ingredients (name, unit, cost_per_unit) VALUES (?, ?, ?)',
      [name, unit, cost_per_unit]
    );
    const row = await db.get('SELECT * FROM ingredients WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await db.get('SELECT * FROM ingredients WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Ingredient not found' });

    const { name, unit, cost_per_unit } = req.body;
    await db.run(
      `UPDATE ingredients SET name = ?, unit = ?, cost_per_unit = ?, updated_at = datetime('now') WHERE id = ?`,
      [name ?? existing.name, unit ?? existing.unit, cost_per_unit ?? existing.cost_per_unit, req.params.id]
    );
    const row = await db.get('SELECT * FROM ingredients WHERE id = ?', [req.params.id]);
    res.json(row);
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
