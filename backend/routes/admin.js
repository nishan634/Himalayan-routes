const router = require('express').Router();
const { getDB } = require('../database/init'); const db = { prepare: (...a) => getDB().prepare(...a) };
const { adminAuth } = require('../middleware/auth');

// GET /api/admin/dashboard
router.get('/dashboard', adminAuth, (req, res) => {
  const stats = {
    bookings: {
      total: db.prepare('SELECT COUNT(*) as c FROM bookings').get().c,
      pending: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status='pending'").get().c,
      confirmed: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status='confirmed'").get().c,
      completed: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status='completed'").get().c,
    },
    users: db.prepare('SELECT COUNT(*) as c FROM users WHERE role=\'user\'').get().c,
    destinations: db.prepare('SELECT COUNT(*) as c FROM destinations WHERE is_active=1').get().c,
    reviews_pending: db.prepare('SELECT COUNT(*) as c FROM reviews WHERE is_approved=0').get().c,
    messages_unread: db.prepare('SELECT COUNT(*) as c FROM contact_messages WHERE is_read=0').get().c,
    itineraries: db.prepare('SELECT COUNT(*) as c FROM itineraries').get().c,
    recent_bookings: db.prepare('SELECT b.*, u.name as user_name FROM bookings b LEFT JOIN users u ON u.id=b.user_id ORDER BY b.created_at DESC LIMIT 10').all(),
    top_destinations: db.prepare('SELECT d.name, d.icon, COUNT(bd.id) as count FROM booking_destinations bd JOIN destinations d ON d.id=bd.destination_id GROUP BY d.id ORDER BY count DESC LIMIT 5').all(),
  };
  res.json(stats);
});

// GET /api/admin/users
router.get('/users', adminAuth, (req, res) => {
  const users = db.prepare('SELECT id,name,email,role,country,phone,created_at FROM users ORDER BY created_at DESC').all();
  users.forEach(u => {
    u.bookings_count = db.prepare('SELECT COUNT(*) as c FROM bookings WHERE user_id=?').get(u.id).c;
  });
  res.json(users);
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', adminAuth, (req, res) => {
  const { role } = req.body;
  if (!['user','admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, req.params.id);
  res.json({ message: 'Role updated' });
});

// GET /api/admin/reviews (pending)
router.get('/reviews', adminAuth, (req, res) => {
  res.json(db.prepare('SELECT r.*, d.name as destination_name FROM reviews r LEFT JOIN destinations d ON d.id=r.destination_id ORDER BY r.created_at DESC').all());
});

module.exports = router;
