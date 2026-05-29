const router = require('express').Router();
const { getDB } = require('../database/init'); const db = { prepare: (...a) => getDB().prepare(...a) };
const { auth, optionalAuth } = require('../middleware/auth');

// POST /api/itineraries — save an itinerary
router.post('/', optionalAuth, (req, res) => {
  const { name, trip_days, interests, group_size, budget_level, fitness_level, arrival_date, stops, session_id } = req.body;
  const result = db.prepare(
    'INSERT INTO itineraries (user_id,session_id,name,trip_days,interests,group_size,budget_level,fitness_level,arrival_date) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(req.user?.id || null, session_id || null, name || 'My Nepal Trip', trip_days || 7, JSON.stringify(interests || []), group_size || null, budget_level || null, fitness_level || null, arrival_date || null);

  const iId = result.lastInsertRowid;
  if (Array.isArray(stops) && stops.length) {
    stops.forEach((s, i) => {
      db.prepare('INSERT INTO itinerary_stops (itinerary_id,destination_id,stop_order) VALUES (?,?,?)').run(iId, s.destination_id, i);
    });
  }

  const itin = db.prepare('SELECT * FROM itineraries WHERE id=?').get(iId);
  itin.stops = db.prepare('SELECT ist.*, d.name, d.icon, d.image_url, d.best_time FROM itinerary_stops ist JOIN destinations d ON d.id=ist.destination_id WHERE ist.itinerary_id=? ORDER BY ist.stop_order').all(iId);
  res.status(201).json(itin);
});

// GET /api/itineraries — user's own
router.get('/', auth, (req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare('SELECT i.*, u.name as user_name FROM itineraries i LEFT JOIN users u ON u.id=i.user_id ORDER BY i.created_at DESC').all()
    : db.prepare('SELECT * FROM itineraries WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);
  rows.forEach(r => {
    r.stops = db.prepare('SELECT ist.*, d.name, d.icon FROM itinerary_stops ist JOIN destinations d ON d.id=ist.destination_id WHERE ist.itinerary_id=? ORDER BY ist.stop_order').all(r.id);
  });
  res.json(rows);
});

// GET /api/itineraries/:id
router.get('/:id', optionalAuth, (req, res) => {
  const itin = db.prepare('SELECT * FROM itineraries WHERE id=?').get(req.params.id);
  if (!itin) return res.status(404).json({ error: 'Itinerary not found' });
  itin.stops = db.prepare('SELECT ist.*, d.name, d.icon, d.image_url, d.best_time, d.duration FROM itinerary_stops ist JOIN destinations d ON d.id=ist.destination_id WHERE ist.itinerary_id=? ORDER BY ist.stop_order').all(itin.id);
  res.json(itin);
});

module.exports = router;
