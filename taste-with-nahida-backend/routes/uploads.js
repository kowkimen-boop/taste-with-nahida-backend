const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const cloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
} else {
  console.log('ℹ No Cloudinary credentials set — uploaded images will be saved to local disk instead (not persistent on most free hosts).');
}

const allowedTypes = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// Cloudinary mode: keep the file in memory, then stream it up
// Local fallback mode: write straight to /uploads on disk
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!cloudinaryConfigured && !fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = cloudinaryConfigured
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`);
      }
    });

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedTypes.includes(ext)) {
      return cb(new Error('Only image files (jpg, png, webp, gif) are allowed'));
    }
    cb(null, true);
  }
});

function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'taste-with-nahida' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

router.post('/', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    let imageUrl;
    if (cloudinaryConfigured) {
      const result = await uploadBufferToCloudinary(req.file.buffer);
      imageUrl = result.secure_url;
    } else {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    if (req.body.addToGallery === 'true') {
      await db.run('INSERT INTO gallery_images (image_url, caption) VALUES (?, ?)', [imageUrl, req.body.caption || '']);
    }

    res.status(201).json({ image_url: imageUrl });
  } catch (err) { next(err); }
});

// Multer / upload error handler
router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

module.exports = router;
