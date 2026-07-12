const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { uniqueSlug } = require('../utils');

const router = express.Router();

function parseRecipe(row) {
  return {
    ...row,
    ingredients: row.ingredients ? JSON.parse(row.ingredients) : [],
    steps: row.steps ? JSON.parse(row.steps) : [],
    published: !!row.published
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    let rows;
    if (category && category !== 'all') {
      rows = await db.all('SELECT * FROM recipes WHERE published = 1 AND category = ? ORDER BY created_at DESC', [category]);
    } else {
      rows = await db.all('SELECT * FROM recipes WHERE published = 1 ORDER BY created_at DESC');
    }
    res.json(rows.map(parseRecipe));
  } catch (err) { next(err); }
});

router.get('/admin/all', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM recipes ORDER BY created_at DESC');
    res.json(rows.map(parseRecipe));
  } catch (err) { next(err); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const row = await db.get('SELECT * FROM recipes WHERE slug = ?', [req.params.slug]);
    if (!row) return res.status(404).json({ error: 'Recipe not found' });
    res.json(parseRecipe(row));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, category, summary, ingredients, steps, image_url, published } = req.body;
    if (!title || !category) {
      return res.status(400).json({ error: 'title and category are required' });
    }
    const slug = await uniqueSlug(db, 'recipes', title);
    const info = await db.run(
      `INSERT INTO recipes (title, slug, category, summary, ingredients, steps, image_url, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, category, summary || '', JSON.stringify(ingredients || []),
       JSON.stringify(steps || []), image_url || '', published === false ? 0 : 1]
    );
    const row = await db.get('SELECT * FROM recipes WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json(parseRecipe(row));
  } catch (err) { next(err); }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await db.get('SELECT * FROM recipes WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Recipe not found' });

    const { title, category, summary, ingredients, steps, image_url, published } = req.body;
    await db.run(
      `UPDATE recipes SET
        title = ?, category = ?, summary = ?, ingredients = ?, steps = ?,
        image_url = ?, published = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        title ?? existing.title,
        category ?? existing.category,
        summary ?? existing.summary,
        JSON.stringify(ingredients ?? JSON.parse(existing.ingredients || '[]')),
        JSON.stringify(steps ?? JSON.parse(existing.steps || '[]')),
        image_url ?? existing.image_url,
        published === undefined ? existing.published : (published ? 1 : 0),
        req.params.id
      ]
    );
    const row = await db.get('SELECT * FROM recipes WHERE id = ?', [req.params.id]);
    res.json(parseRecipe(row));
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const info = await db.run('DELETE FROM recipes WHERE id = ?', [req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Recipe not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
