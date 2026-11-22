const { Schema, model } = require('mongoose');

// A machine exists only after an owner adds it.
module.exports = model('Machine', new Schema({
  owner:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ownerName: { type: String, trim: true },
  name:      { type: String, required: true, trim: true, maxlength: 80 },
  type:      { type: String, required: true, trim: true },
  rate:      { type: Number, required: true, min: 1 },     // Rs per hour
  location:  { type: String, trim: true, maxlength: 80 },
  available: { type: Boolean, default: true }
}, { timestamps: true }));
