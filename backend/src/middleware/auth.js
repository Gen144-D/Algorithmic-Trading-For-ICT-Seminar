const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
}

// Short-lived token used to confirm the 2FA step of login.
function signPending2FA(payload) {
  return jwt.sign({ ...payload, purpose: '2fa' }, SECRET, { expiresIn: '5m' });
}

function requirePending2FA(token) {
  const payload = jwt.verify(token, SECRET);
  if (payload.purpose !== '2fa') throw new Error('Invalid pending token');
  return payload;
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { signToken, authRequired, signPending2FA, requirePending2FA };