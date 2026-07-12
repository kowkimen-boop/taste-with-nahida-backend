const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: { error: 'Too many attempts. Please try again later.' }
});

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', subscribeLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    try {
      await db.run('INSERT INTO newsletter_subscribers (email) VALUES (?)', [email.toLowerCase()]);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) {
        return res.status(200).json({ success: true, alreadySubscribed: true });
      }
      throw err;
    }

    res.status(201).json({ success: true });
  } catch (err) { next(err); }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/export.csv', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.all('SELECT email, created_at FROM newsletter_subscribers ORDER BY created_at DESC');
    const csv = ['email,subscribed_at', ...rows.map(r => `${r.email},${r.created_at}`)].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="subscribers.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await db.run('DELETE FROM newsletter_subscribers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
