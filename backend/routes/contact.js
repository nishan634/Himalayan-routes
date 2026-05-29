const router = require('express').Router();
const { getDB } = require('../database/init'); const db = { prepare: (...a) => getDB().prepare(...a) };
const { adminAuth } = require('../middleware/auth');

router.post('/', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'Name, email and message required' });
  db.prepare('INSERT INTO contact_messages (name,email,subject,message) VALUES (?,?,?,?)').run(name, email, subject || null, message);
  res.status(201).json({ message: 'Message received! We will reply within 24 hours.' });
});

router.get('/', adminAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all());
});

router.put('/:id/read', adminAuth, (req, res) => {
  db.prepare('UPDATE contact_messages SET is_read=1 WHERE id=?').run(req.params.id);
  res.json({ message: 'Marked as read' });
});

module.exports = router;
