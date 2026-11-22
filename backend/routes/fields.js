const router = require('express').Router();
const Field = require('../models/Field');
const auth = require('../middleware/auth');
router.use(auth, auth.role('farmer'));

router.get('/', async (req, res, next) => {
  try { res.json(await Field.find({ user: req.user.id }).sort('-createdAt')); } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, area, crop, location } = req.body;
    res.status(201).json(await Field.create({ user: req.user.id, name, area: Number(area), crop, location }));
  } catch (e) {
    if (e.name === 'ValidationError') return res.status(400).json({ error: 'Please fill the field name and a valid area' });
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, area, crop, location } = req.body;
    const f = await Field.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { name, area, crop, location }, { new: true, runValidators: true });
    f ? res.json(f) : res.status(404).json({ error: 'Field not found' });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const f = await Field.findOneAndDelete({ _id: req.params.id, user: req.user.id });   // user filter = nobody deletes another farmer's field
    f ? res.json({ ok: true }) : res.status(404).json({ error: 'Field not found' });
  } catch (e) { next(e); }
});

module.exports = router;
