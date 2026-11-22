const jwt = require('jsonwebtoken');

// Requires "Authorization: Bearer <token>"; sets req.user = { id, role }
const auth = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please log in' });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: p.id, role: p.role };
    next();
  } catch (e) {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
};

// auth.role('owner')  -> only users who chose the "owner" role may continue
auth.role = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: `This is only for: ${roles.join(' / ')}` });

module.exports = auth;
