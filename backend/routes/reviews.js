const router = require('express').Router();
const { getDB } = require('../database/init'); const db = { prepare: (...a) => getDB().prepare(...a) };
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

// GET /api/reviews
router.get('/', (req, res) => {
  const { destination_id } = req.query;
  let sql = 'SELECT * FROM reviews WHERE is_approved=1';
  const params = [];
  if (destination_id) { sql += ' AND destination_id=?'; params.push(destination_id); }
  sql += ' ORDER BY created_at DESC LIMIT 50';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/reviews
router.post('/', optionalAuth, (req, res) => {
  const { reviewer_name, reviewer_country, rating, title, body, destination_id } = req.body;
  if (!reviewer_name || !rating || !body) return res.status(400).json({ error: 'Name, rating and body required' });
  const result = db.prepare('INSERT INTO reviews (user_id,destination_id,reviewer_name,reviewer_country,rating,title,body) VALUES (?,?,?,?,?,?,?)').run(req.user?.id || null, destination_id || null, reviewer_name, reviewer_country || null, rating, title || null, body);
  res.status(201).json({ message: 'Review submitted and pending approval', id: result.lastInsertRowid });
});

// PUT /api/reviews/:id/approve — admin
router.put('/:id/approve', adminAuth, (req, res) => {
  db.prepare('UPDATE reviews SET is_approved=1 WHERE id=?').run(req.params.id);
  res.json({ message: 'Review approved' });
});

module.exports = router;
