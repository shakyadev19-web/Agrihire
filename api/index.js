// Vercel entry point: every /api/** request is handled by the same Express app that runs locally (backend/app.js).
module.exports = require('../backend/app').createApp({ behindProxy: true });
