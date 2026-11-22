const router = require('express').Router();
const Machine = require('../models/Machine');
const User = require('../models/User');
const auth = require('../middleware/auth');
router.use(auth);

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/machines?type=Tractor&q=mahindra   -> only machines that real owners added
router.get('/', async (req, res, next) => {
  try {
    const f = { available: true };
    if (req.query.type) f.type = String(req.query.type);
    if (req.query.q) f.name = new RegExp(esc(req.query.q), 'i');
    res.json(await Machine.find(f).sort('rate').limit(100));
  } catch (e) { next(e); }
});

// GET /api/machines/mine   (owner's own machines)
router.get('/mine', auth.role('owner'), async (req, res, next) => {
  try { res.json(await Machine.find({ owner: req.user.id }).sort('-createdAt')); } catch (e) { next(e); }
});

// POST /api/machines   { type, model, rate, location }
router.post('/', auth.role('owner'), async (req, res, next) => {
  try {
    const { type, model, rate, location } = req.body;
    const u = await User.findById(req.user.id);
    res.status(201).json(await Machine.create({ owner: u._id, ownerName: u.name, name: model, type, rate: Number(rate), location }));
  } catch (e) {
    if (e.name === 'ValidationError') return res.status(400).json({ error: 'Please fill type, model and a valid rate' });
    next(e);
  }
});

router.delete('/:id', auth.role('owner'), async (req, res, next) => {
  try {
    const m = await Machine.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    m ? res.json({ ok: true }) : res.status(404).json({ error: 'Machine not found' });
  } catch (e) { next(e); }
});

module.exports = router;
