// The Express application. Used by server.js (your computer) and by functions/index.js (Firebase).
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const connect = require('./db');

function createApp({ serveFrontend = false, behindProxy = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (behindProxy) app.set('trust proxy', true);              // cloud: use the visitor's real IP (rate limit)

  // ---- Basic security headers ----
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(self)'
    });
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  // ---- API ----
  app.get('/api/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');                      // answers must never be cached by a CDN
    connect().then(() => next()).catch(err => {
      console.error('MongoDB connection failed:', err.message);
      res.status(503).json({ error: 'Database unavailable. Please try again in a moment.' });
    });
  });
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/fields', require('./routes/fields'));
  app.use('/api/machines', require('./routes/machines'));
  app.use('/api/workers', require('./routes/workers'));
  app.use('/api/bookings', require('./routes/bookings'));
  app.use('/api/stats', require('./routes/stats'));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // ---- Frontend (only when running on your own computer; Firebase Hosting serves it online) ----
  if (serveFrontend) {
    app.use((req, res, next) => {                               // never expose server code, .env or build scripts
      if (/^\/(backend|functions|scripts)(\/|$)/i.test(req.path) || /\.(py|env)$/i.test(req.path)) return res.sendStatus(404);
      next();
    });
    app.use(express.static(path.join(__dirname, '..'), { dotfiles: 'deny' }));
  }

  // ---- Errors (always JSON) ----
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });

  return app;
}

module.exports = { createApp };
