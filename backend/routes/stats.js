const router = require('express').Router();
const Booking = require('../models/Booking');
const Machine = require('../models/Machine');
const Field = require('../models/Field');
const auth = require('../middleware/auth');
router.use(auth);

// GET /api/stats?as=user   -> numbers for the farmer (bookings I made)
// GET /api/stats?as=owner  -> numbers for the owner / worker (bookings made on my machines / for me)
router.get('/', async (req, res, next) => {
  try {
    const as = req.query.as === 'owner' ? 'owner' : 'user';
    const id = req.user.id;
    const mine = await Booking.find({ [as]: id }).lean();
    const paid = mine.filter(b => b.status === 'confirmed' || b.status === 'done');
    const sum = list => list.reduce((t, b) => t + b.total, 0);

    // last 4 months (by service date), oldest first
    const now = new Date();
    const months = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en-US', { month: 'short' }), value: 0 });
    }
    paid.forEach(b => { const m = months.find(x => x.key === b.date.slice(0, 7)); if (m) m.value += b.total; });

    const counted = mine.filter(b => b.status !== 'cancelled').length;
    const done = mine.filter(b => b.status === 'done').length;

    res.json({
      bookings: mine.length,
      pending: mine.filter(b => b.status === 'pending').length,
      completed: done,
      completedPct: counted ? Math.round((done / counted) * 100) : 0,
      amount: sum(paid),
      month: months[3].value,
      byMonth: months.map(({ label, value }) => ({ label, value })),
      machines: await Machine.countDocuments({ owner: id }),
      fields: await Field.countDocuments({ user: id })
    });
  } catch (e) { next(e); }
});

module.exports = router;
