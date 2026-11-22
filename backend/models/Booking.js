const { Schema, model } = require('mongoose');

const s = new Schema({
  user:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },   // farmer who booked
  userName: { type: String },
  owner:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },   // machine owner / worker
  kind:     { type: String, enum: ['machine', 'worker'], required: true },
  itemId:   { type: Schema.Types.ObjectId, required: true },                             // Machine or Worker _id
  item:     { type: String, required: true },                                            // its name (for display)
  field:    { type: String, trim: true, maxlength: 80 },
  task:     { type: String, trim: true, maxlength: 40 },
  rate:     { type: Number, required: true },                                            // copied from the database
  date:     { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  hours:    { type: Number, required: true, min: 1, max: 24 },
  total:    { type: Number, required: true },
  status:   { type: String, enum: ['pending', 'confirmed', 'done', 'cancelled'], default: 'pending' }
}, { timestamps: true });

// The database itself refuses two active bookings for the same machine/worker on the same day.
s.index({ itemId: 1, date: 1 }, {
  unique: true,
  partialFilterExpression: { status: { $in: ['pending', 'confirmed'] }, itemId: { $exists: true } }
});

module.exports = model('Booking', s);
