const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../database/init'); const db = { prepare: (...a) => getDB().prepare(...a) };
const { auth } = require('../middleware/auth');

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password, phone, country } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password, phone, country) VALUES (?,?,?,?,?)').run(name.trim(), email.toLowerCase().trim(), hash, phone || null, country || null);
  const token = sign(result.lastInsertRowid);
  res.status(201).json({ token, user: { id: result.lastInsertRowid, name, email, role: 'user' } });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = sign(user.id);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json(req.user);
});

// PUT /api/auth/profile
router.put('/profile', auth, (req, res) => {
  const { name, phone, country } = req.body;
  db.prepare('UPDATE users SET name=?, phone=?, country=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(name, phone, country, req.user.id);
  res.json({ message: 'Profile updated' });
});

// PUT /api/auth/password
router.put('/password', auth, (req, res) => {
  const { current, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(current, user.password)) return res.status(400).json({ error: 'Current password incorrect' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password too short' });
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, req.user.id);
  res.json({ message: 'Password updated' });
});

module.exports = router;
