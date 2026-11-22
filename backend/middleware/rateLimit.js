// Tiny in-memory rate limiter (no extra npm package needed).
// Example: rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }) -> 30 requests per 15 minutes per IP.
module.exports = ({ windowMs, max, message = 'Too many attempts. Please try again later.' }) => {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    let h = hits.get(req.ip);
    if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(req.ip, h); }
    if (++h.n > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
};
