require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db');

const authRoutes = require('./routes/auth');
const recipeRoutes = require('./routes/recipes');
const reviewRoutes = require('./routes/reviews');
const blogRoutes = require('./routes/blog');
const uploadRoutes = require('./routes/uploads');
const galleryRoutes = require('./routes/gallery');
const contactRoutes = require('./routes/contact');
const newsletterRoutes = require('./routes/newsletter');
const ingredientRoutes = require('./routes/ingredients');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const settingsRoutes = require('./routes/settings');

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '2mb' }));

// Serve locally-stored uploads (only used when Cloudinary isn't configured)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the admin dashboard (static HTML/JS)
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

app.use('/api/auth', authRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

// Wait for the database (schema + admin user) to be ready before accepting requests
db.ready()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🍛 Taste with Nahida API running on http://localhost:${PORT}`);
      console.log(`   Admin dashboard:  http://localhost:${PORT}/admin`);
      console.log(`   Health check:     http://localhost:${PORT}/api/health\n`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize the database:', err);
    process.exit(1);
  });
