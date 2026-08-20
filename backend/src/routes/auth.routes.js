const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getStore } = require('../config/db');
const { signToken, authRequired, signPending2FA } = require('../middleware/auth');
const totp = require('../modules/totp');

const router = express.Router();

// --- register ---
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const store = await getStore();
    if (await store.findUserByEmail(email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const user = await store.createUser({ name, email, passwordHash });
    const tokens = await issueTokens(store, user);
    res.status(201).json({ ...tokens, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// --- login (returns need2fa when 2FA is enabled) ---
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const store = await getStore();
    const user = await store.findUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const profile = await store.getProfile(user.id);
    if (profile && profile.two_factor_enabled) {
      const pendingToken = signPending2FA({ id: user.id });
      return res.json({ need2fa: true, pendingToken });
    }
    const tokens = await issueTokens(store, user);
    res.json({ ...tokens, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// --- verify 2FA code during login ---
router.post('/2fa/verify', async (req, res, next) => {
  try {
    const { pendingToken, code } = req.body;
    const { requirePending2FA } = require('../middleware/auth');
    const payload = requirePending2FA(pendingToken);
    const store = await getStore();
    const user = await store.findUserById(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const profile = await store.getProfile(user.id);
    const secret = profile?.two_factor_secret;
    if (!secret || !totp.verifyTOTP(secret, code)) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }
    const tokens = await issueTokens(store, user);
    res.json({ ...tokens, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// --- refresh token exchange ---
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });
    const store = await getStore();
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await store.findRefreshToken(tokenHash);
    if (!stored || stored.revoked) return res.status(401).json({ error: 'Invalid refresh token' });
    if (new Date(stored.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    const user = await store.findUserById(stored.user_id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    await store.revokeRefreshToken(tokenHash);
    const tokens = await issueTokens(store, user);
    res.json({ ...tokens, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// --- logout (revoke refresh) ---
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const store = await getStore();
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await store.revokeRefreshToken(tokenHash);
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// --- me ---
router.get('/me', authRequired, async (req, res, next) => {
  try {
    const store = await getStore();
    const user = await store.findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(publicUser(user));
  } catch (err) {
    next(err);
  }
});

// --- profile (onboarding: experience, risk profile, preferred markets) ---
router.get('/profile', authRequired, async (req, res, next) => {
  try {
    const store = await getStore();
    const profile = await store.getProfile(req.user.id);
    res.json(profile || {});
  } catch (err) {
    next(err);
  }
});

router.put('/profile', authRequired, async (req, res, next) => {
  try {
    const { experience, risk_profile, preferred_markets } = req.body;
    const store = await getStore();
    const profile = await store.upsertProfile(req.user.id, {
      experience,
      risk_profile,
      preferred_markets,
    });
    await store.addLog(req.user.id, 'PROFILE_UPDATED', { experience, risk_profile });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// --- 2FA setup ---
router.post('/2fa/setup', authRequired, async (req, res, next) => {
  try {
    const store = await getStore();
    const user = await store.findUserById(req.user.id);
    const secret = totp.generateSecret();
    await store.upsertProfile(req.user.id, { two_factor_secret: secret, two_factor_enabled: false });
    res.json({
      secret,
      otpauth: totp.otpauthURI(secret, user.email),
    });
  } catch (err) {
    next(err);
  }
});

// --- enable 2FA (must pass a valid code) ---
router.post('/2fa/enable', authRequired, async (req, res, next) => {
  try {
    const { code } = req.body;
    const store = await getStore();
    const profile = await store.getProfile(req.user.id);
    if (!profile?.two_factor_secret) return res.status(400).json({ error: 'Run 2FA setup first' });
    if (!totp.verifyTOTP(profile.two_factor_secret, code || '')) {
      return res.status(400).json({ error: 'Invalid 2FA code' });
    }
    await store.upsertProfile(req.user.id, { two_factor_enabled: true });
    await store.addLog(req.user.id, '2FA_ENABLED', {});
    res.json({ two_factor_enabled: true });
  } catch (err) {
    next(err);
  }
});

// --- disable 2FA ---
router.post('/2fa/disable', authRequired, async (req, res, next) => {
  try {
    const store = await getStore();
    await store.upsertProfile(req.user.id, { two_factor_enabled: false });
    res.json({ two_factor_enabled: false });
  } catch (err) {
    next(err);
  }
});

// --- password reset (stateless JWT token, logged in dev) ---
router.post('/password/reset', async (req, res, next) => {
  try {
    const { email } = req.body;
    const store = await getStore();
    const user = await store.findUserByEmail(email);
    if (user) {
      const token = require('jsonwebtoken').sign(
        { id: user.id, purpose: 'reset' },
        process.env.JWT_SECRET || 'dev-secret-change-me',
        { expiresIn: '15m' }
      );
      const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
      console.log(`[auth] password reset for ${email}: ${resetUrl}`);
      if (process.env.NODE_ENV !== 'production') {
        return res.json({ ok: true, devResetUrl: resetUrl });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- confirm password reset ---
router.post('/password/reset/confirm', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'token and newPassword (6+ chars) are required' });
    }
    let payload;
    try {
      payload = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    } catch {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    if (payload.purpose !== 'reset') return res.status(400).json({ error: 'Invalid reset token' });
    const store = await getStore();
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await store.updatePassword(payload.id, passwordHash);
    await store.addLog(payload.id, 'PASSWORD_RESET', {});
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- helpers ---
async function issueTokens(store, user) {
  const accessToken = signToken({ id: user.id, email: user.email });
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await store.createRefreshToken({ userId: user.id, tokenHash, expiresAt });
  return { token: accessToken, refreshToken };
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, balance: user.balance };
}

module.exports = router;