const { Schema, model } = require('mongoose');

// One pending SMS code per phone number and purpose. MongoDB deletes it automatically after expiresAt.
const s = new Schema({
  phone:      { type: String, required: true },
  purpose:    { type: String, enum: ['verify', 'reset'], required: true },
  codeHash:   { type: String, required: true },            // the code itself is never stored
  attempts:   { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
  expiresAt:  { type: Date, required: true }
});
s.index({ phone: 1, purpose: 1 }, { unique: true });
s.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model('Otp', s);
