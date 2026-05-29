const router = require('express').Router();
const { getDB } = require('../database/init'); const db = { prepare: (...a) => getDB().prepare(...a) };
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

// POST /api/bookings — create new booking inquiry
router.post('/', optionalAuth, (req, res) => {
  const { first_name, last_name, email, whatsapp, arrival_date, trip_duration, tour_type, group_size, special_requests, destinations } = req.body;
  if (!first_name || !last_name || !email) return res.status(400).json({ error: 'First name, last name and email are required' });

  const result = db.prepare(
    'INSERT INTO bookings (user_id,first_name,last_name,email,whatsapp,arrival_date,trip_duration,tour_type,group_size,special_requests) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(req.user?.id || null, first_name, last_name, email, whatsapp || null, arrival_date || null, trip_duration || null, tour_type || null, group_size || null, special_requests || null);

  const bookingId = result.lastInsertRowid;

  if (Array.isArray(destinations) && destinations.length) {
    destinations.forEach(({ destination_id, day_number }) => {
      db.prepare('INSERT INTO booking_destinations (booking_id,destination_id,day_number) VALUES (?,?,?)').run(bookingId, destination_id, day_number || null);
    });
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id=?').get(bookingId);
  res.status(201).json({ message: 'Booking inquiry submitted! We will contact you within 2 hours.', booking });
});

// GET /api/bookings — user's own bookings (or all for admin)
router.get('/', auth, (req, res) => {
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare('SELECT b.*, u.name as user_name FROM bookings b LEFT JOIN users u ON u.id=b.user_id ORDER BY b.created_at DESC').all();
  } else {
    rows = db.prepare('SELECT * FROM bookings WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);
  }
  rows.forEach(b => {
    b.destinations = db.prepare('SELECT bd.*, d.name, d.icon FROM booking_destinations bd JOIN destinations d ON d.id=bd.destination_id WHERE bd.booking_id=?').all(b.id);
  });
  res.json(rows);
});

// GET /api/bookings/:id
router.get('/:id', auth, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (req.user.role !== 'admin' && booking.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  booking.destinations = db.prepare('SELECT bd.*, d.name, d.icon, d.image_url FROM booking_destinations bd JOIN destinations d ON d.id=bd.destination_id WHERE bd.booking_id=?').all(booking.id);
  res.json(booking);
});

// PUT /api/bookings/:id/status — admin only
router.put('/:id/status', adminAuth, (req, res) => {
  const { status, admin_notes, total_price } = req.body;
  const allowed = ['pending','reviewing','confirmed','cancelled','completed'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE bookings SET status=?, admin_notes=?, total_price=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, admin_notes || null, total_price || null, req.params.id);
  res.json({ message: 'Booking updated', booking: db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id) });
});

// GET /api/bookings/stats — admin summary
router.get('/admin/stats', adminAuth, (req, res) => {
  const stats = {
    total: db.prepare('SELECT COUNT(*) as c FROM bookings').get().c,
    pending: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status='pending'").get().c,
    confirmed: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status='confirmed'").get().c,
    completed: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status='completed'").get().c,
    this_month: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now')").get().c,
  };
  res.json(stats);
});

module.exports = router;
