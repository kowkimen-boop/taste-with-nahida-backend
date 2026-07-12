const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Public read — the admin dashboard needs this before login isn't required,
// and it's just a display preference (currency symbol), not sensitive data.
router.get('/', async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { next(err); }
});

// Admin-only write
router.put('/', requireAuth, async (req, res, next) => {
  try {
    const updates = req.body; // e.g. { currency_symbol: '৳', currency_code: 'BDT' }
    for (const [key, value] of Object.entries(updates)) {
      const existing = await db.get('SELECT key FROM settings WHERE key = ?', [key]);
      if (existing) {
        await db.run('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
      } else {
        await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
      }
    }
    const rows = await db.all('SELECT * FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { next(err); }
});

module.exports = router;
