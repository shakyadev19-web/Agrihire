// Issue and check one-time codes (stored hashed in MongoDB, expire after 5 minutes).
const Otp = require('../models/Otp');
const { generate, hash, same } = require('./otpCode');
const sms = require('./sms');

const TTL = 5 * 60 * 1000;          // a code is valid for 5 minutes
const COOLDOWN = 30 * 1000;         // at most one new code every 30 seconds
const MAX_ATTEMPTS = 5;             // then the code is thrown away

class OtpError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function issue(phone, purpose) {
  const now = Date.now();
  const old = await Otp.findOne({ phone, purpose });
  if (old && now - old.lastSentAt.getTime() < COOLDOWN)
    throw new OtpError(`Please wait ${Math.ceil((COOLDOWN - (now - old.lastSentAt.getTime())) / 1000)} seconds before asking for a new code.`, 429);

  const code = generate();
  await Otp.findOneAndUpdate({ phone, purpose },
    { codeHash: hash(code, phone, purpose), attempts: 0, lastSentAt: new Date(now), expiresAt: new Date(now + TTL) },
    { upsert: true, new: true, setDefaultsOnInsert: true });
  try {
    await sms.sendOtp(phone, code);
  } catch (e) {
    await Otp.deleteOne({ phone, purpose });
    console.error('SMS failed:', e.message);
    throw new OtpError('Could not send the SMS. Please try again later.', 502);
  }
}

async function verify(phone, purpose, code) {
  // the attempt counter is increased in the same step as the lookup, so parallel guesses cannot beat the limit
  const rec = await Otp.findOneAndUpdate({ phone, purpose, expiresAt: { $gt: new Date() } }, { $inc: { attempts: 1 } }, { new: true });
  if (!rec) throw new OtpError('Code expired. Please ask for a new one.', 400);
  if (rec.attempts > MAX_ATTEMPTS) {
    await Otp.deleteOne({ _id: rec._id });
    throw new OtpError('Too many wrong attempts. Please ask for a new code.', 429);
  }
  if (!same(rec.codeHash, hash(String(code || '').trim(), phone, purpose)))
    throw new OtpError('Wrong code. Please check the SMS and try again.', 400);
  await Otp.deleteOne({ _id: rec._id });               // a code works only once
}

module.exports = { issue, verify, OtpError };
