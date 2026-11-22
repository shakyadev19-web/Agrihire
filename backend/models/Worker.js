const { Schema, model } = require('mongoose');

// A worker profile exists only after a user signs up as "worker" and fills the profile form.
const s = new Schema({
  user:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name:      { type: String, required: true, trim: true },
  skill:     { type: String, required: true, trim: true, maxlength: 60 },
  rate:      { type: Number, required: true, min: 1 },     // Rs per day
  village:   { type: String, trim: true, maxlength: 80 },
  groupSize: { type: Number, default: 1, min: 1, max: 200 },
  available: { type: Boolean, default: true }
}, { timestamps: true });
s.index({ user: 1 }, { unique: true });

module.exports = model('Worker', s);
