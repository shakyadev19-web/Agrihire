// Runs at every start: removes records from older demo versions and updates the indexes.
const User = require('../models/User');
const Field = require('../models/Field');
const Machine = require('../models/Machine');
const Worker = require('../models/Worker');
const Booking = require('../models/Booking');
const Otp = require('../models/Otp');

module.exports = async () => {
  const removed = await Promise.all([
    Machine.deleteMany({ owner: { $exists: false } }),        // demo machines had no owner
    Worker.deleteMany({ user: { $exists: false } }),          // demo workers had no user account
    Booking.deleteMany({ itemId: { $exists: false } })        // old bookings of demo items
  ]);
  const n = removed.reduce((t, r) => t + r.deletedCount, 0);
  if (n) console.log(`Removed ${n} old demo record(s)`);
  await Promise.all([User, Field, Machine, Worker, Booking, Otp].map(m => m.syncIndexes()));
};
