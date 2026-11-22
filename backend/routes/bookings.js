const router = require('express').Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Machine = require('../models/Machine');
const Worker = require('../models/Worker');
const User = require('../models/User');
const auth = require('../middleware/auth');
router.use(auth);

const ACTIVE = { $in: ['pending', 'confirmed'] };
// Allowed status changes. "done" and "cancelled" are final.
const FLOW = { pending: ['confirmed', 'cancelled'], confirmed: ['done', 'cancelled'] };
const isoToday = () => new Date().toISOString().slice(0, 10);

// GET /api/bookings/check?itemId=...&date=YYYY-MM-DD  -> { available: true/false }
router.get('/check', auth.role('farmer'), async (req, res, next) => {
  try {
    const { itemId, date } = req.query;
    res.json({ available: !(await Booking.exists({ itemId, date, status: ACTIVE })) });
  } catch (e) { next(e); }
});

// POST /api/bookings   { kind, itemId, date, hours, field?, task? }   (farmers only)
router.post('/', auth.role('farmer'), async (req, res, next) => {
  try {
    const { kind, itemId, date, hours, field, task } = req.body;
    const h = Number(hours);
    if (!['machine', 'worker'].includes(kind) || !mongoose.isValidObjectId(itemId) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !(h >= 1 && h <= 24))
      return res.status(400).json({ error: 'Item, date and hours are required' });
    if (date < isoToday()) return res.status(400).json({ error: 'Please choose a future date' });

    // price and owner come from the database, never from the browser
    const doc = await (kind === 'machine' ? Machine : Worker).findById(itemId);
    if (!doc || doc.available === false) return res.status(404).json({ error: 'This machine / worker is no longer available' });
    const owner = kind === 'machine' ? doc.owner : doc.user;
    if (String(owner) === req.user.id) return res.status(400).json({ error: 'You cannot book your own listing' });

    const farmer = await User.findById(req.user.id);
    const b = await Booking.create({
      user: farmer._id, userName: farmer.name, owner, kind, itemId: doc._id, item: doc.name,
      field: String(field || '').slice(0, 80), task: String(task || '').slice(0, 40),
      rate: doc.rate, date, hours: h, total: doc.rate * h
    });
    res.status(201).json(b);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'This slot is already booked. Pick another date.' });
    next(e);
  }
});

// GET /api/bookings -> my bookings (farmer)
router.get('/', async (req, res, next) => {
  try { res.json(await Booking.find({ user: req.user.id }).sort('-createdAt').limit(200)); } catch (e) { next(e); }
});

// GET /api/bookings/requests -> bookings made on my machines / for me as a worker
router.get('/requests', async (req, res, next) => {
  try { res.json(await Booking.find({ owner: req.user.id }).sort('-createdAt').limit(200)); } catch (e) { next(e); }
});

// GET /api/bookings/:id -> one booking. The other person's name + phone appear once it is confirmed.
router.get('/:id', async (req, res, next) => {
  try {
    const b = await Booking.findById(req.params.id).lean();
    const mine = b && String(b.user) === req.user.id, theirs = b && String(b.owner) === req.user.id;
    if (!mine && !theirs) return res.status(404).json({ error: 'Booking not found' });
    let contact = null;
    if (b.status === 'confirmed' || b.status === 'done') {
      const other = await User.findById(mine ? b.owner : b.user).select('name phone');
      if (other) contact = { name: other.name, phone: other.phone };
    }
    res.json(Object.assign({}, b, { contact }));
  } catch (e) { next(e); }
});

// PATCH /api/bookings/:id   { status }      owner / worker: confirmed, done, cancelled      farmer: cancelled only
router.patch('/:id', async (req, res, next) => {
  try {
    const b = await Booking.findById(req.params.id);
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    const mine = String(b.user) === req.user.id, theirs = String(b.owner) === req.user.id;
    if (!mine && !theirs) return res.status(403).json({ error: 'Not your booking' });

    const s = req.body.status;
    if (!['confirmed', 'done', 'cancelled'].includes(s)) return res.status(400).json({ error: 'Invalid status' });
    if (!theirs && s !== 'cancelled') return res.status(403).json({ error: 'Only the owner can do this' });
    if (!(FLOW[b.status] || []).includes(s)) return res.status(409).json({ error: `A ${b.status} booking cannot become ${s}` });

    b.status = s;
    await b.save();
    res.json(b);
  } catch (e) { next(e); }
});

module.exports = router;
