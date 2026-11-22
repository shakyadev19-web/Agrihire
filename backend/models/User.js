const { Schema, model } = require('mongoose');

module.exports = model('User', new Schema({
  name:         { type: String, required: true, trim: true, maxlength: 80 },
  phone:        { type: String, required: true, unique: true, match: /^\d{10}$/ },
  passwordHash: { type: String, required: true },          // bcrypt hash, never the real password
  village:      { type: String, trim: true, maxlength: 80 },
  role:         { type: String, enum: ['farmer', 'owner', 'worker'] },   // chosen once, after the OTP check
  verified:     { type: Boolean, default: false }          // true after the SMS code was entered
}, { timestamps: true }));
