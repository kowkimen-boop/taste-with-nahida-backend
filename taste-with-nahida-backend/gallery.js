const express = require('express');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: { error: 'Too many messages sent. Please try again later.' }
});

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

router.post('/', contactLimiter, async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'name, email, and message are required' });
    }

    await db.run(
      'INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
      [name, email, subject || '', message]
    );

    const transporter = getTransporter();
    if (transporter && process.env.CONTACT_TO_EMAIL) {
      try {
        await transporter.sendMail({
          from: `"Taste with Nahida Website" <${process.env.SMTP_USER}>`,
          to: process.env.CONTACT_TO_EMAIL,
          replyTo: email,
          subject: `New contact message: ${subject || 'No subject'}`,
          text: `From: ${name} <${email}>\n\n${message}`
        });
      } catch (err) {
        console.error('Email send failed (message was still saved):', err.message);
      }
    }

    res.status(201).json({ success: true });
  } catch (err) { next(err); }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.all('SELECT * FROM contact_messages ORDER BY created_at DESC');
    res.json(rows.map(r => ({ ...r, read: !!r.read })));
  } catch (err) { next(err); }
});

router.put('/:id/read', requireAuth, async (req, res, next) => {
  try {
    await db.run('UPDATE contact_messages SET read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await db.run('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
