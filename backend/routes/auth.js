const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Worker = require('../models/Worker');
const Machine = require('../models/Machine');
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const otp = require('../services/otp');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });            // slows down password guessing
const smsLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many code requests. Please try again later.' });

const ROLES = ['farmer', 'owner', 'worker'];
const sign = u => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = u => ({ id: u._id, name: u.name, phone: u.phone, village: u.village, role: u.role });
const cleanPhone = v => String(v || '').trim();
const validPhone = p => /^\d{10}$/.test(p);
const validPassword = p => typeof p === 'string' && p.length >= 6 && p.length <= 72;
// OTP problems (wrong code, wait 30 s, SMS down) are answered directly; everything else goes to the error handler
const handle = (res, next) => e => (e instanceof otp.OtpError ? res.status(e.status).json({ error: e.message }) : next(e));

// POST /api/auth/register  { name, phone, password, village }  -> sends an SMS code, no login yet
router.post('/register', smsLimiter, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim(), phone = cleanPhone(req.body.phone);
    const village = String(req.body.village || '').trim(), password = req.body.password;
    if (!name || !validPhone(phone)) return res.status(400).json({ error: 'Name and a 10-digit mobile number are required' });
    if (!validPassword(password)) return res.status(400).json({ error: 'Password must be 6 to 72 characters' });

    let u = await User.findOne({ phone });
    if (u && u.verified) return res.status(409).json({ error: 'This mobile number is already registered. Please log in.' });
    const passwordHash = await bcrypt.hash(password, 10);
    if (u) { u.name = name; u.village = village; u.passwordHash = passwordHash; await u.save(); }   // unfinished sign-up: start again
    else u = await User.create({ name, phone, village, passwordHash });

    await otp.issue(phone, 'verify');
    res.status(201).json({ ok: true, phone });
  } catch (e) { handle(res, next)(e); }
});

// POST /api/auth/verify  { phone, code }  -> number confirmed, user is logged in
router.post('/verify', limiter, async (req, res, next) => {
  try {
    const phone = cleanPhone(req.body.phone);
    const u = validPhone(phone) && await User.findOne({ phone });
    if (!u) return res.status(400).json({ error: 'Please register first' });
    await otp.verify(phone, 'verify', req.body.code);
    u.verified = true;
    await u.save();
    res.json({ token: sign(u), user: pub(u) });
  } catch (e) { handle(res, next)(e); }
});

// POST /api/auth/resend  { phone }  -> new SMS code for an unfinished sign-up
router.post('/resend', smsLimiter, async (req, res, next) => {
  try {
    const phone = cleanPhone(req.body.phone);
    const u = validPhone(phone) && await User.findOne({ phone });
    if (u && !u.verified) await otp.issue(phone, 'verify');
    res.json({ ok: true });                                   // same answer for unknown numbers (no user guessing)
  } catch (e) { handle(res, next)(e); }
});

// POST /api/auth/login  { phone, password }
router.post('/login', limiter, async (req, res, next) => {
  try {
    const phone = cleanPhone(req.body.phone);
    const u = await User.findOne({ phone });
    if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.passwordHash)))
      return res.status(401).json({ error: 'Wrong mobile number or password' });   // same message for both
    if (!u.verified) {
      try { await otp.issue(phone, 'verify'); } catch (e) { if (!(e instanceof otp.OtpError)) throw e; }
      return res.status(403).json({ error: 'Please confirm your mobile number. We sent you an SMS code.', needsVerify: true, phone });
    }
    res.json({ token: sign(u), user: pub(u) });
  } catch (e) { next(e); }
});

// POST /api/auth/forgot  { phone }  -> SMS code for a new password
router.post('/forgot', smsLimiter, async (req, res, next) => {
  try {
    const phone = cleanPhone(req.body.phone);
    if (!validPhone(phone)) return res.status(400).json({ error: 'Enter your 10-digit mobile number' });
    const u = await User.findOne({ phone, verified: true });
    if (u) await otp.issue(phone, 'reset');
    res.json({ ok: true });                                   // same answer whether the number exists or not
  } catch (e) { handle(res, next)(e); }
});

// POST /api/auth/reset  { phone, code, password }
router.post('/reset', limiter, async (req, res, next) => {
  try {
    const phone = cleanPhone(req.body.phone);
    if (!validPassword(req.body.password)) return res.status(400).json({ error: 'Password must be 6 to 72 characters' });
    const u = validPhone(phone) && await User.findOne({ phone, verified: true });
    if (!u) return res.status(400).json({ error: 'Wrong code. Please check the SMS and try again.' });
    await otp.verify(phone, 'reset', req.body.code);
    u.passwordHash = await bcrypt.hash(req.body.password, 10);
    await u.save();
    res.json({ ok: true });
  } catch (e) { handle(res, next)(e); }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res, next) => {
  try {
    const u = await User.findById(req.user.id);
    if (!u) return res.status(401).json({ error: 'Please log in again' });
    res.json({ user: pub(u) });
  } catch (e) { next(e); }
});

// PATCH /api/auth/me  { role?, name?, village? }   role can be chosen once and never changed
router.patch('/me', auth, async (req, res, next) => {
  try {
    const u = await User.findById(req.user.id);
    if (!u) return res.status(401).json({ error: 'Please log in again' });
    const { role, name, village } = req.body;
    if (role !== undefined) {
      if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
      if (u.role && u.role !== role) return res.status(409).json({ error: 'Your role is already set and cannot be changed' });
      u.role = role;
    }
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: 'Name cannot be empty' });
      u.name = String(name).trim();
    }
    if (village !== undefined) u.village = String(village).trim();
    await u.save();
    if (name !== undefined) {                                  // keep listings in step with the new name
      await Worker.updateOne({ user: u._id }, { name: u.name });
      await Machine.updateMany({ owner: u._id }, { ownerName: u.name });
    }
    res.json({ token: sign(u), user: pub(u) });               // new token so the role inside it is current
  } catch (e) {
    if (e.name === 'ValidationError') return res.status(400).json({ error: e.message });
    next(e);
  }
});

module.exports = router;
