const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { uniqueSlug } = require('../utils');

const router = express.Router();
const withBool = r => ({ ...r, published: !!r.published });

router.get('/', async (req, res, next) => {
  try {
    const { country } = req.query;
    let rows;
    if (country && country !== 'all') {
      rows = await db.all('SELECT * FROM reviews WHERE published = 1 AND country = ? ORDER BY created_at DESC', [country]);
    } else {
      rows = await db.all('SELECT * FROM reviews WHERE published = 1 ORDER BY created_at DESC');
    }
    res.json(rows.map(withBool));
  } catch (err) { next(err); }
});

router.get('/admin/all', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM reviews ORDER BY created_at DESC');
    res.json(rows.map(withBool));
  } catch (err) { next(err); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const row = await db.get('SELECT * FROM reviews WHERE slug = ?', [req.params.slug]);
    if (!row) return res.status(404).json({ error: 'Review not found' });
    res.json(withBool(row));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { restaurant_name, country, location, rating, body, image_url, published } = req.body;
    if (!restaurant_name || !country || rating === undefined) {
      return res.status(400).json({ error: 'restaurant_name, country, and rating are required' });
    }
    const slug = await uniqueSlug(db, 'reviews', restaurant_name);
    const info = await db.run(
      `INSERT INTO reviews (restaurant_name, slug, country, location, rating, body, image_url, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [restaurant_name, slug, country, location || '', rating, body || '', image_url || '', published === false ? 0 : 1]
    );
    const row = await db.get('SELECT * FROM reviews WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json(withBool(row));
  } catch (err) { next(err); }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await db.get('SELECT * FROM reviews WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Review not found' });

    const { restaurant_name, country, location, rating, body, image_url, published } = req.body;
    await db.run(
      `UPDATE reviews SET
        restaurant_name = ?, country = ?, location = ?, rating = ?, body = ?,
        image_url = ?, published = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        restaurant_name ?? existing.restaurant_name,
        country ?? existing.country,
        location ?? existing.location,
        rating ?? existing.rating,
        body ?? existing.body,
        image_url ?? existing.image_url,
        published === undefined ? existing.published : (published ? 1 : 0),
        req.params.id
      ]
    );
    const row = await db.get('SELECT * FROM reviews WHERE id = ?', [req.params.id]);
    res.json(withBool(row));
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const info = await db.run('DELETE FROM reviews WHERE id = ?', [req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Review not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
