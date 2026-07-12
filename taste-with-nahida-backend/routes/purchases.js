const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth); // business data — admin only

// Log a purchase: adds to stock, and updates the ingredient's cost to this
// purchase's price (since we track "most recent purchase price", not an average).
router.post('/', async (req, res, next) => {
  try {
    const { ingredient_id, quantity, total_cost, store, purchase_date, notes } = req.body;
    if (!ingredient_id || !quantity || total_cost === undefined) {
      return res.status(400).json({ error: 'ingredient_id, quantity, and total_cost are required' });
    }

    const ingredient = await db.get('SELECT * FROM ingredients WHERE id = ?', [ingredient_id]);
    if (!ingredient) return res.status(404).json({ error: 'Ingredient not found' });

    const unitCost = total_cost / quantity;
    const date = purchase_date || new Date().toISOString().slice(0, 10);

    const info = await db.run(
      `INSERT INTO purchases (ingredient_id, quantity, total_cost, unit_cost, store, purchase_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ingredient_id, quantity, total_cost, unitCost, store || '', date, notes || '']
    );

    await db.run(
      `UPDATE ingredients SET current_stock = current_stock + ?, cost_per_unit = ?, updated_at = datetime('now') WHERE id = ?`,
      [quantity, unitCost, ingredient_id]
    );

    const updatedIngredient = await db.get('SELECT * FROM ingredients WHERE id = ?', [ingredient_id]);
    const purchase = await db.get('SELECT * FROM purchases WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json({ purchase, ingredient: { ...updatedIngredient, stock_value: updatedIngredient.current_stock * updatedIngredient.cost_per_unit } });
  } catch (err) { next(err); }
});

// Purchase history — optionally filtered to one ingredient
router.get('/', async (req, res, next) => {
  try {
    const { ingredient_id } = req.query;
    let rows;
    if (ingredient_id) {
      rows = await db.all('SELECT * FROM purchases WHERE ingredient_id = ? ORDER BY purchase_date DESC, created_at DESC', [ingredient_id]);
    } else {
      rows = await db.all('SELECT * FROM purchases ORDER BY purchase_date DESC, created_at DESC');
    }
    res.json(rows);
  } catch (err) { next(err); }
});

// Delete a purchase — reverses its effect on stock, and recalculates the
// ingredient's cost back to whatever the next-most-recent purchase was.
router.delete('/:id', async (req, res, next) => {
  try {
    const purchase = await db.get('SELECT * FROM purchases WHERE id = ?', [req.params.id]);
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

    await db.run(
      'UPDATE ingredients SET current_stock = current_stock - ? WHERE id = ?',
      [purchase.quantity, purchase.ingredient_id]
    );
    await db.run('DELETE FROM purchases WHERE id = ?', [req.params.id]);

    // Recalculate cost_per_unit from whatever purchase is now the most recent
    const nextMostRecent = await db.get(
      'SELECT * FROM purchases WHERE ingredient_id = ? ORDER BY purchase_date DESC, created_at DESC LIMIT 1',
      [purchase.ingredient_id]
    );
    if (nextMostRecent) {
      await db.run('UPDATE ingredients SET cost_per_unit = ? WHERE id = ?', [nextMostRecent.unit_cost, purchase.ingredient_id]);
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
