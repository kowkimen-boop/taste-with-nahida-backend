const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { uniqueSlug } = require('../utils');

const router = express.Router();
const withBool = r => ({ ...r, published: !!r.published });

router.get('/', async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM blog_posts WHERE published = 1 ORDER BY created_at DESC');
    res.json(rows.map(withBool));
  } catch (err) { next(err); }
});

router.get('/admin/all', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM blog_posts ORDER BY created_at DESC');
    res.json(rows.map(withBool));
  } catch (err) { next(err); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const row = await db.get('SELECT * FROM blog_posts WHERE slug = ?', [req.params.slug]);
    if (!row) return res.status(404).json({ error: 'Post not found' });
    res.json(withBool(row));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, country, body, image_url, published } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const slug = await uniqueSlug(db, 'blog_posts', title);
    const info = await db.run(
      `INSERT INTO blog_posts (title, slug, country, body, image_url, published) VALUES (?, ?, ?, ?, ?, ?)`,
      [title, slug, country || '', body || '', image_url || '', published === false ? 0 : 1]
    );
    const row = await db.get('SELECT * FROM blog_posts WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json(withBool(row));
  } catch (err) { next(err); }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await db.get('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Post not found' });

    const { title, country, body, image_url, published } = req.body;
    await db.run(
      `UPDATE blog_posts SET
        title = ?, country = ?, body = ?, image_url = ?, published = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        title ?? existing.title,
        country ?? existing.country,
        body ?? existing.body,
        image_url ?? existing.image_url,
        published === undefined ? existing.published : (published ? 1 : 0),
        req.params.id
      ]
    );
    const row = await db.get('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
    res.json(withBool(row));
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const info = await db.run('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
