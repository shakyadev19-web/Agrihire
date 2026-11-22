const { Schema, model } = require('mongoose');

module.exports = model('Field', new Schema({
  user:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name:     { type: String, required: true, trim: true, maxlength: 60 },
  area:     { type: Number, required: true, min: 0.1 },     // acre
  crop:     { type: String, trim: true, maxlength: 40 },
  location: { type: String, trim: true, maxlength: 80 }
}, { timestamps: true }));
