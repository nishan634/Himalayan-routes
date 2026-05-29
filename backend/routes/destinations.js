const router = require('express').Router();
const { getDB } = require('../database/init'); const db = { prepare: (...a) => getDB().prepare(...a) };
const { adminAuth } = require('../middleware/auth');

const getFullDestination = (id) => {
  const dest = db.prepare('SELECT * FROM destinations WHERE id=? AND is_active=1').get(id);
  if (!dest) return null;
  dest.highlights = db.prepare('SELECT highlight FROM destination_highlights WHERE destination_id=? ORDER BY id').all(id).map(r => r.highlight);
  dest.why_visit = db.prepare('SELECT reason FROM why_visit WHERE destination_id=? ORDER BY sort_order').all(id).map(r => r.reason);
  dest.activities = db.prepare('SELECT activity FROM activities WHERE destination_id=? ORDER BY sort_order').all(id).map(r => r.activity);
  dest.itinerary = db.prepare('SELECT day_label, title, description FROM itinerary_days WHERE destination_id=? ORDER BY sort_order').all(id);
  dest.avg_rating = db.prepare('SELECT ROUND(AVG(rating),1) as avg FROM reviews WHERE destination_id=? AND is_approved=1').get(id)?.avg || null;
  dest.review_count = db.prepare('SELECT COUNT(*) as c FROM reviews WHERE destination_id=? AND is_approved=1').get(id)?.c || 0;
  return dest;
};

// GET /api/destinations
router.get('/', (req, res) => {
  const { category, featured, search } = req.query;
  let sql = 'SELECT d.*, ROUND(AVG(r.rating),1) as avg_rating, COUNT(r.id) as review_count FROM destinations d LEFT JOIN reviews r ON r.destination_id=d.id AND r.is_approved=1 WHERE d.is_active=1';
  const params = [];
  if (category) { sql += ' AND d.category=?'; params.push(category); }
  if (featured) { sql += ' AND d.is_featured=1'; }
  if (search) { sql += ' AND (d.name LIKE ? OR d.region LIKE ? OR d.description LIKE ?)'; const s = `%${search}%`; params.push(s,s,s); }
  sql += ' GROUP BY d.id ORDER BY d.is_featured DESC, d.id ASC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// GET /api/destinations/featured
router.get('/featured', (req, res) => {
  const rows = db.prepare('SELECT * FROM destinations WHERE is_active=1 AND is_featured=1 ORDER BY id').all();
  res.json(rows);
});

// GET /api/destinations/:id
router.get('/:id', (req, res) => {
  const dest = getFullDestination(req.params.id);
  if (!dest) return res.status(404).json({ error: 'Destination not found' });
  res.json(dest);
});

// POST /api/destinations — admin only
router.post('/', adminAuth, (req, res) => {
  const { name, category, description, best_time, duration, difficulty, altitude, region, nearest_city, image_url, icon, is_featured, highlights, why_visit, activities, itinerary } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Name and category required' });
  const result = db.prepare('INSERT INTO destinations (name,category,description,best_time,duration,difficulty,altitude,region,nearest_city,image_url,icon,is_featured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(name,category,description,best_time,duration,difficulty,altitude,region,nearest_city,image_url,icon,is_featured?1:0);
  const id = result.lastInsertRowid;
  if (highlights?.length) highlights.forEach(h => db.prepare('INSERT INTO destination_highlights (destination_id,highlight) VALUES (?,?)').run(id,h));
  if (why_visit?.length) why_visit.forEach((r,i) => db.prepare('INSERT INTO why_visit (destination_id,reason,sort_order) VALUES (?,?,?)').run(id,r,i));
  if (activities?.length) activities.forEach((a,i) => db.prepare('INSERT INTO activities (destination_id,activity,sort_order) VALUES (?,?,?)').run(id,a,i));
  if (itinerary?.length) itinerary.forEach((d,i) => db.prepare('INSERT INTO itinerary_days (destination_id,day_label,title,description,sort_order) VALUES (?,?,?,?,?)').run(id,d.day_label,d.title,d.description,i));
  res.status(201).json(getFullDestination(id));
});

// PUT /api/destinations/:id — admin only
router.put('/:id', adminAuth, (req, res) => {
  const { name, category, description, best_time, duration, difficulty, altitude, region, nearest_city, image_url, icon, is_featured } = req.body;
  db.prepare('UPDATE destinations SET name=?,category=?,description=?,best_time=?,duration=?,difficulty=?,altitude=?,region=?,nearest_city=?,image_url=?,icon=?,is_featured=? WHERE id=?').run(name,category,description,best_time,duration,difficulty,altitude,region,nearest_city,image_url,icon,is_featured?1:0,req.params.id);
  res.json(getFullDestination(req.params.id));
});

// DELETE /api/destinations/:id — admin only
router.delete('/:id', adminAuth, (req, res) => {
  db.prepare('UPDATE destinations SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ message: 'Destination deactivated' });
});

module.exports = router;
