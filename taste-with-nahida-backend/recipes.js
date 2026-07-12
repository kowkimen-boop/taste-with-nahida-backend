const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth); // business data — admin only

async function getProductWithCost(productId) {
  const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product) return null;

  const ingredientRows = await db.all(
    `SELECT pi.id as link_id, pi.ingredient_id, pi.quantity, i.name, i.unit, i.cost_per_unit
     FROM product_ingredients pi
     JOIN ingredients i ON i.id = pi.ingredient_id
     WHERE pi.product_id = ?
     ORDER BY i.name ASC`,
    [productId]
  );

  const cost_to_make = ingredientRows.reduce((sum, r) => sum + (r.quantity * r.cost_per_unit), 0);
  const profit_per_unit = product.selling_price - cost_to_make;
  const margin_percent = product.selling_price ? (profit_per_unit / product.selling_price) * 100 : null;

  return {
    ...product,
    ingredients: ingredientRows.map(r => ({
      link_id: r.link_id,
      ingredient_id: r.ingredient_id,
      name: r.name,
      unit: r.unit,
      cost_per_unit: r.cost_per_unit,
      quantity: r.quantity,
      line_cost: r.quantity * r.cost_per_unit
    })),
    cost_to_make,
    profit_per_unit,
    margin_percent
  };
}

router.get('/', async (req, res, next) => {
  try {
    const products = await db.all('SELECT id FROM products ORDER BY name ASC');
    const full = await Promise.all(products.map(p => getProductWithCost(p.id)));
    res.json(full);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await getProductWithCost(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, category, selling_price, notes, ingredients } = req.body;
    if (!name || selling_price === undefined) {
      return res.status(400).json({ error: 'name and selling_price are required' });
    }
    const info = await db.run(
      'INSERT INTO products (name, category, selling_price, notes) VALUES (?, ?, ?, ?)',
      [name, category || '', selling_price, notes || '']
    );
    const productId = info.lastInsertRowid;

    if (Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        if (!ing.ingredient_id || !ing.quantity) continue;
        await db.run(
          'INSERT INTO product_ingredients (product_id, ingredient_id, quantity) VALUES (?, ?, ?)',
          [productId, ing.ingredient_id, ing.quantity]
        );
      }
    }

    res.status(201).json(await getProductWithCost(productId));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const { name, category, selling_price, notes, ingredients } = req.body;
    await db.run(
      `UPDATE products SET name = ?, category = ?, selling_price = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
      [
        name ?? existing.name,
        category ?? existing.category,
        selling_price ?? existing.selling_price,
        notes ?? existing.notes,
        req.params.id
      ]
    );

    if (Array.isArray(ingredients)) {
      await db.run('DELETE FROM product_ingredients WHERE product_id = ?', [req.params.id]);
      for (const ing of ingredients) {
        if (!ing.ingredient_id || !ing.quantity) continue;
        await db.run(
          'INSERT INTO product_ingredients (product_id, ingredient_id, quantity) VALUES (?, ?, ?)',
          [req.params.id, ing.ingredient_id, ing.quantity]
        );
      }
    }

    res.json(await getProductWithCost(req.params.id));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await db.run('DELETE FROM product_ingredients WHERE product_id = ?', [req.params.id]);
    const info = await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
