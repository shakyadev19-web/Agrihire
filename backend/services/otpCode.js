// Pure helpers for SMS codes (no database here, so they are easy to test).
const crypto = require('crypto');

const generate = () => String(crypto.randomInt(100000, 1000000));           // 6 digits, cryptographically random
const hash = (code, phone, purpose) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${purpose}:${phone}:${code}`).digest('hex');
const same = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

module.exports = { generate, hash, same };
