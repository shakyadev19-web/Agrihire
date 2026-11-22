const router = require('express').Router();
const Worker = require('../models/Worker');
const User = require('../models/User');
const auth = require('../middleware/auth');
router.use(auth);

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/workers?skill=&q=   -> only people who signed up as "worker" and finished their profile
router.get('/', async (req, res, next) => {
  try {
    const f = { available: true };
    if (req.query.skill) f.skill = new RegExp(esc(req.query.skill), 'i');
    if (req.query.q) f.name = new RegExp(esc(req.query.q), 'i');
    res.json(await Worker.find(f).sort('rate').limit(100));
  } catch (e) { next(e); }
});

// GET /api/workers/me   -> my profile (404 until the profile form was saved)
router.get('/me', auth.role('worker'), async (req, res, next) => {
  try {
    const w = await Worker.findOne({ user: req.user.id });
    w ? res.json(w) : res.status(404).json({ error: 'No worker profile yet' });
  } catch (e) { next(e); }
});

// PUT /api/workers/me   { skill, rate, village, groupSize }   create or update my profile
router.put('/me', auth.role('worker'), async (req, res, next) => {
  try {
    const { skill, rate, village, groupSize } = req.body;
    const u = await User.findById(req.user.id);
    const w = await Worker.findOneAndUpdate(
      { user: u._id },
      { user: u._id, name: u.name, skill, rate: Number(rate), village, groupSize: Number(groupSize) || 1 },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
    res.json(w);
  } catch (e) {
    if (e.name === 'ValidationError') return res.status(400).json({ error: 'Please fill skill and a valid daily wage' });
    next(e);
  }
});

// PATCH /api/workers/me   { available }   switch "available for work" on / off
router.patch('/me', auth.role('worker'), async (req, res, next) => {
  try {
    const w = await Worker.findOneAndUpdate({ user: req.user.id }, { available: !!req.body.available }, { new: true });
    w ? res.json(w) : res.status(404).json({ error: 'No worker profile yet' });
  } catch (e) { next(e); }
});

module.exports = router;
