const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM gallery_images ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { image_url, caption } = req.body;
    if (!image_url) return res.status(400).json({ error: 'image_url is required' });
    const info = await db.run('INSERT INTO gallery_images (image_url, caption) VALUES (?, ?)', [image_url, caption || '']);
    const row = await db.get('SELECT * FROM gallery_images WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const info = await db.run('DELETE FROM gallery_images WHERE id = ?', [req.params.id]);
    if (info.changes === 0) return res.status(404).json({ error: 'Image not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
