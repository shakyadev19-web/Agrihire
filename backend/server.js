// Starts AgriHire on your own computer:  npm start
require('dotenv').config();
const mongoose = require('mongoose');
const { createApp } = require('./app');
const connect = require('./db');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET missing - copy .env.example to .env and set it.');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
let server;

connect()
  .then(() => { server = createApp({ serveFrontend: true }).listen(PORT, () => console.log(`AgriHire running at http://localhost:${PORT}`)); })
  .catch(err => { console.error('MongoDB connection failed:', err.message); process.exit(1); });

const shutdown = () => {
  console.log('\nStopping...');
  const done = () => mongoose.disconnect().finally(() => process.exit(0));
  server ? server.close(done) : done();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
