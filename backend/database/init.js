// database/init.js — SQL.js powered SQLite (pure JS, no native bindings)
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.resolve(process.env.DB_PATH || './database/himalaya_routes.db');
let db = null;
let SQL = null;

// Save DB to disk periodically and on exit
function saveToDisk() {
  if (!db || !SQL) return;
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) { console.error('DB save error:', e.message); }
}

// Wrapper to make sql.js feel like better-sqlite3 (sync API)
function makeWrapper(sqlDb) {
  return {
    _db: sqlDb,
    exec(sql) { sqlDb.run(sql); saveToDisk(); },
    pragma() {},
    prepare(sql) {
      return {
        run(...args) {
          try {
            sqlDb.run(sql, args);
            saveToDisk();
            // Get lastInsertRowid
            const r = sqlDb.exec('SELECT last_insert_rowid() as id');
            return { lastInsertRowid: r[0]?.values[0][0] || 0, changes: sqlDb.getRowsModified() };
          } catch(e) { throw e; }
        },
        get(...args) {
          const stmt = sqlDb.prepare(sql);
          stmt.bind(args);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...args) {
          const results = [];
          const stmt = sqlDb.prepare(sql);
          stmt.bind(args);
          while (stmt.step()) results.push(stmt.getAsObject());
          stmt.free();
          return results;
        }
      };
    }
  };
}

async function initDB() {
  SQL = await initSqlJs();
  // Load from disk if exists, else create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  const wrapper = makeWrapper(db);
  global._db = wrapper;

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
      phone TEXT, country TEXT, role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS destinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, category TEXT NOT NULL, description TEXT,
      best_time TEXT, duration TEXT, difficulty TEXT, altitude TEXT,
      region TEXT, nearest_city TEXT, image_url TEXT, icon TEXT,
      is_featured INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS destination_highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      destination_id INTEGER NOT NULL, highlight TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS why_visit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      destination_id INTEGER NOT NULL, reason TEXT NOT NULL, sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      destination_id INTEGER NOT NULL, activity TEXT NOT NULL, sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS itinerary_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      destination_id INTEGER NOT NULL, day_label TEXT NOT NULL,
      title TEXT NOT NULL, description TEXT NOT NULL, sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
      email TEXT NOT NULL, whatsapp TEXT, arrival_date TEXT, trip_duration TEXT,
      tour_type TEXT, group_size TEXT, special_requests TEXT,
      status TEXT DEFAULT 'pending', total_price REAL, admin_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS booking_destinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL, destination_id INTEGER NOT NULL, day_number INTEGER
    );
    CREATE TABLE IF NOT EXISTS itineraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER, session_id TEXT, name TEXT DEFAULT 'My Nepal Trip',
      trip_days INTEGER DEFAULT 7, interests TEXT, group_size TEXT,
      budget_level TEXT, fitness_level TEXT, arrival_date TEXT,
      status TEXT DEFAULT 'draft', created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS itinerary_stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itinerary_id INTEGER NOT NULL, destination_id INTEGER NOT NULL, stop_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER, booking_id INTEGER, destination_id INTEGER,
      reviewer_name TEXT NOT NULL, reviewer_country TEXT,
      rating INTEGER, title TEXT, body TEXT, is_approved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT,
      message TEXT NOT NULL, is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER, action TEXT NOT NULL, entity_type TEXT,
      entity_id INTEGER, details TEXT, ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  saveToDisk();
  console.log('✅ Database tables ready');
  seedAdmin(wrapper);
  seedDestinations(wrapper);
  console.log('✅ Database seeded');
}

function seedAdmin(w) {
  const existing = w.prepare('SELECT id FROM users WHERE email = ?').get('admin@himalayanroutes.com');
  if (existing) return;
  const hash = bcrypt.hashSync('Admin@123', 10);
  w.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)').run('Admin','admin@himalayanroutes.com',hash,'admin');
  console.log('✅ Admin created: admin@himalayanroutes.com / Admin@123');
}

function seedDestinations(w) {
  const count = w.prepare('SELECT COUNT(*) as c FROM destinations').get();
  if (count && count.c > 0) return;

  const destinations = [
    { id:1, name:'Everest Base Camp Trek', category:'trek', icon:'🏔️', image_url:'https://images.unsplash.com/photo-1608301213564-4c8a9ef9a0ee?w=900&q=80', description:'The world\'s most iconic trek — 14 days through Sherpa villages, Buddhist monasteries and glacial moraines to the foot of the world\'s highest peak at 5,364m.', best_time:'Oct-Nov, Mar-May', duration:'12-14 days', difficulty:'Challenging', altitude:'5,364m', region:'Solukhumbu, Koshi', nearest_city:'Lukla', is_featured:1,
      highlights:['Kala Patthar Sunrise','Tengboche Monastery','Namche Bazaar','Khumbu Icefall','Sherpa Culture','Sagarmatha NP'],
      why_visit:['Stand at the foot of Mount Everest (8,849m) and gaze up the Khumbu Icefall from Base Camp (5,364m). Few experiences match the sheer scale.','Trek through living Sherpa culture — Namche Bazaar, Tengboche Monastery, and dozens of traditional villages.','Kala Patthar viewpoint (5,545m) gives the finest views of Everest\'s summit and the entire Khumbu range.','Acclimatize at Namche Bazaar and enjoy the Everest View Hotel at 3,880m — the world\'s highest-altitude hotel.'],
      activities:['🥾 Multi-day trekking','🧘 Sherpa village stays','📸 Himalayan photography','🏕️ High-altitude camping','☸️ Monastery visits','🚁 Helicopter return option','🌄 Kala Patthar sunrise','🍜 Dal bhat at tea houses'],
      itinerary:[{day:'Day 1-2',title:'Fly to Lukla, Trek to Namche',desc:'Scenic mountain flight to Lukla (2,860m). Trek through Phakding to Namche Bazaar (3,440m).'},{day:'Day 3-5',title:'Namche Acclimatization',desc:'Acclimatization hike to Everest View Hotel (3,880m). Explore the Saturday market.'},{day:'Day 6-9',title:'Tengboche to Lobuche',desc:'Trek through rhododendron forests to Tengboche Monastery. Continue to Lobuche.'},{day:'Day 10-11',title:'EBC & Kala Patthar',desc:'Trek to Gorak Shep. Afternoon to Everest Base Camp (5,364m). Pre-dawn climb to Kala Patthar (5,545m).'},{day:'Day 12-14',title:'Return to Lukla',desc:'Descend through familiar terrain. Fly back to Kathmandu.'}]
    },
    { id:2, name:'Pokhara & Phewa Lake', category:'nature', icon:'🌊', image_url:'https://images.unsplash.com/photo-1571401835393-8c5f35328320?w=900&q=80', description:'Nepal\'s most beautiful city — a lakeside paradise with reflections of the Annapurna range on Phewa Lake, adventure sports, and the most relaxed atmosphere in the Himalayas.', best_time:'Oct-May', duration:'2-3 days', difficulty:'Easy', altitude:'827m', region:'Gandaki Province', nearest_city:'Pokhara', is_featured:1,
      highlights:['Phewa Lake Reflection','Fishtail Peak','Lakeside Strip','Davis Falls','Bat Cave','Mountain Museum'],
      why_visit:['Phewa Lake\'s mirror-perfect reflections of Machhapuchhre and the Annapurna range create one of the most photographed landscapes in Asia.','Pokhara is the adventure capital of Nepal — paragliding, zip-lining, rock climbing, and kayaking all available.','The famous Lakeside strip is the most relaxed traveller hub in Nepal.','Visit Davis Falls, Mahendra Cave, and the International Mountain Museum.'],
      activities:['🚣 Rowing on Phewa Lake','🪂 Tandem paragliding','🛶 Barahi Temple boat visit','🌄 Sarangkot sunrise','🎣 Lakeside fishing','🚵 Mountain biking','🌊 Davis Falls visit','🏛️ Mountain Museum'],
      itinerary:[{day:'Day 1',title:'Arrival & Lake',desc:'Arrive in Pokhara. Afternoon rowing on Phewa Lake to the Barahi Temple island. Sunset from the Lakeside promenade.'},{day:'Day 2',title:'Sarangkot & Activities',desc:'Pre-dawn trip to Sarangkot for mountain sunrise. Choose your adventure: paragliding or Davis Falls.'},{day:'Day 3',title:'Mountain Museum',desc:'Visit the International Mountain Museum and explore the old Bazaar.'}]
    },
    { id:3, name:'Annapurna Base Camp Trek', category:'trek', icon:'⛰️', image_url:'https://images.unsplash.com/photo-1606117331085-5760e3097277?w=900&q=80', description:'Trek into the heart of the Annapurna Sanctuary — a breathtaking glacial amphitheatre surrounded by 7 peaks over 7,000m including Annapurna I (8,091m).', best_time:'Oct-Nov, Mar-May', duration:'10-12 days', difficulty:'Moderate', altitude:'4,130m', region:'Gandaki Province', nearest_city:'Pokhara', is_featured:1,
      highlights:['ABC Sunrise Views','Annapurna Sanctuary','Rhododendron Forests','Jhinu Hot Springs','Machhapuchhre','Modi Khola Valley'],
      why_visit:['Trek into the Annapurna Sanctuary — ringed by 7 peaks over 7,000m.','Passes through the most beautiful rhododendron forests in Nepal — spectacular in March-May.','Soak in the natural hot springs at Jhinu Danda after days of trekking.','Shorter and more accessible than EBC with equally stunning scenery.'],
      activities:['🥾 Multi-day trekking','🌸 Rhododendron forests','🧖 Hot spring soak','📸 Glacier photography','☀️ Sunrise at Base Camp','🎭 Gurung village visits','🍜 Tea house meals','🌄 Annapurna South views'],
      itinerary:[{day:'Day 1-2',title:'Nayapul to Ghorepani',desc:'Drive to Nayapul. Trek to Ghorepani (2,860m).'},{day:'Day 3-4',title:'Poon Hill & Chhomrong',desc:'Pre-dawn hike to Poon Hill (3,210m). Trek to Chhomrong (2,170m).'},{day:'Day 5-8',title:'Into the Sanctuary',desc:'Climb through bamboo forests to Annapurna Base Camp (4,130m).'},{day:'Day 9-12',title:'Return via Jhinu Danda',desc:'Descend. Stop at Jhinu hot springs. Return to Pokhara.'}]
    },
    { id:4, name:'Chitwan National Park', category:'nature', icon:'🐘', image_url:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80', description:'UNESCO World Heritage jungle safari — spot one-horned rhinos, Bengal tigers, wild elephants and gharial crocodiles in Nepal\'s most famous national park.', best_time:'Oct-Jun', duration:'2-4 days', difficulty:'Easy', altitude:'200m', region:'Bagmati & Narayani', nearest_city:'Bharatpur', is_featured:1,
      highlights:['Rhino Jeep Safari','Tiger Tracking','Gharial Canoe','Tharu Culture','570+ Birds','UNESCO Heritage'],
      why_visit:['Home to over 700 one-horned rhinos and 125+ Bengal tigers — one of the best places on Earth for rhino sightings.','UNESCO World Heritage Site protecting 68 mammals, 570 birds, and 149 butterfly species.','The Tharu people\'s stick dances offer fascinating cultural encounters.','Canoe rides past basking gharials are among Nepal\'s most serene experiences.'],
      activities:['🦏 Jeep safari for rhinos','🐅 Tiger tracking walks','🐊 Canoe ride for gharials','🚶 Guided jungle walks','🦜 Bird watching (570+)','🏘️ Tharu cultural village','🎭 Tharu stick dance show','🌿 Elephant grass walk'],
      itinerary:[{day:'Day 1',title:'Arrival & Orientation',desc:'Arrive in Chitwan. Evening Tharu cultural dance. Park briefing.'},{day:'Day 2',title:'Full Jungle Safari',desc:'Morning jungle walk. Full-day jeep safari. Afternoon canoe ride. Elephant breeding centre.'},{day:'Day 3',title:'Birding & Village',desc:'Dawn birding with expert guide. Tharu village visit.'}]
    },
    { id:5, name:'Kathmandu Durbar Square', category:'culture', icon:'🏯', image_url:'https://images.unsplash.com/photo-1605640840605-14ac1855827b?w=900&q=80', description:'The historic heart of the ancient Malla kingdom — a UNESCO World Heritage Site of medieval temples, courtyards and the living goddess Kumari\'s palace.', best_time:'Year-round', duration:'Half-Full day', difficulty:'Easy', altitude:'1,400m', region:'Kathmandu Valley', nearest_city:'Kathmandu', is_featured:1,
      highlights:['Kumari Palace','Kasthamandap','Taleju Temple','Ancient Courtyards','Newari Architecture','Indra Chowk'],
      why_visit:['Stand in the ancient royal plaza where Kathmandu\'s kings held court for 800 years.','Witness the living Kumari Goddess — the earthly embodiment of the divine.','The Kasthamandap wooden temple rebuilt after 2015 — a symbol of Nepal\'s resilience.','Explore ancient streets with incense shops and bronze casting workshops.'],
      activities:['🏛️ Temple complex tour','👸 Kumari Goddess viewing','📿 Kasthamandap visit','🎨 Traditional art shopping','🍜 Newari cuisine','📸 Architecture photography','🌅 Sunset from Basantapur Tower','🛒 Indra Chowk market'],
      itinerary:[{day:'Day 1',title:'Durbar Square Deep Dive',desc:'Kasthamandap. Kumari Goddess (10am-12pm best). Hanuman Dhoka palace. Indra Chowk and Asan market. Sunset from Basantapur Tower.'}]
    },
    { id:6, name:'Boudhanath Stupa', category:'culture', icon:'☸️', image_url:'https://images.unsplash.com/photo-1582654454409-778f6619ddc6?w=900&q=80', description:'One of the largest stupas in the world and the spiritual center of Tibetan Buddhism in Nepal. Spin prayer wheels as monks chant and incense fills the air.', best_time:'Year-round', duration:'Half day', difficulty:'Easy', altitude:'1,400m', region:'Kathmandu Valley', nearest_city:'Kathmandu', is_featured:1,
      highlights:['Buddha Eyes','Prayer Wheels','Tibetan Monasteries','Butter Lamps','Rooftop Cafes','Meditation'],
      why_visit:['One of Asia\'s most powerful spiritual sites — the massive stupa radiates peace as pilgrims perform kora.','The all-seeing Buddha eyes atop the 36-meter dome are Nepal\'s most iconic image.','Dozens of Tibetan monasteries offering meditation and thangka painting workshops.','The evening butter lamp ceremony is one of the most unforgettable experiences in Kathmandu.'],
      activities:['☸️ Kora walk','🕯️ Butter lamp ceremony','📿 Prayer wheel spinning','🧘 Monastery meditation','🎨 Thangka shopping','☕ Rooftop café','📸 Dawn photography','🎶 Singing bowl shopping'],
      itinerary:[{day:'Day 1',title:'Full Boudhanath Experience',desc:'Early morning kora. Spin 108 prayer wheels. Monastery prayers. Rooftop café lunch. Dusk butter lamp ceremony.'}]
    },
    { id:7, name:'Pashupatinath Temple', category:'culture', icon:'🔱', image_url:'https://images.unsplash.com/photo-1548013146-72479768bada?w=900&q=80', description:'The most sacred Hindu temple in Nepal. Pilgrims from across South Asia pray while ancient cremation ghats line the holy Bagmati River.', best_time:'Year-round', duration:'Half day', difficulty:'Easy', altitude:'1,400m', region:'Kathmandu Valley', nearest_city:'Kathmandu', is_featured:0,
      highlights:['Cremation Ghats','Shiva Temple','Sadhus','Bagmati River','Evening Aarti','Maha Shivaratri'],
      why_visit:['Nepal\'s holiest Hindu temple, a UNESCO World Heritage Site dedicated to Lord Shiva.','Witness sacred cremation rituals on the Bagmati River — a profound spiritual experience.','Colorful sadhus who share blessings and ancient stories make for vivid encounters.','During Maha Shivaratri, over a million devotees gather for Nepal\'s biggest festival.'],
      activities:['🛕 Temple exploration','🕍 Cremation ghat viewing','🧘 Sadhu encounters','🙏 Evening aarti','🌊 Bagmati River walk','📸 Cultural photography','🦌 Deer park walk','🎭 Maha Shivaratri'],
      itinerary:[{day:'Day 1',title:'Pashupatinath Pilgrimage',desc:'Western bank views of cremation ghats. Eastern bank deer park and sadhus. Evening aarti ceremony.'}]
    },
    { id:8, name:'Upper Mustang', category:'trek', icon:'🏜️', image_url:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=80', description:'The Forbidden Kingdom — restricted permit zone with surreal Tibetan plateau landscape, cave monasteries, and the walled city of Lo Manthang.', best_time:'Jun-Sep', duration:'10-12 days', difficulty:'Challenging', altitude:'3,840m', region:'Mustang, Gandaki', nearest_city:'Jomsom', is_featured:1,
      highlights:['Lo Manthang','Sky Caves','Tibetan Monasteries','Red Cliffs','Rain Shadow Trek','Ancient Frescoes'],
      why_visit:['Closed to foreigners until 1992 — one of the most restricted and pristine Himalayan regions.','Otherworldly landscape of red and ochre canyons, wind-eroded cliffs and Tibetan plateau.','Lo Manthang contains centuries-old monasteries with priceless 15th-century murals.','Best trekked during monsoon season when Mustang\'s rain shadow keeps skies clear.'],
      activities:['🏰 Lo Manthang city tour','🏔️ Sky cave exploration','🎨 Monastery murals','🐴 Horse riding','🌋 Red cliff photography','🏘️ Loba village stays','📿 Restricted area trek','🎥 Landscape photography'],
      itinerary:[{day:'Day 1-3',title:'Jomsom to Ghami',desc:'Fly to Jomsom. Trek north through Kagbeni. Canyon landscapes.'},{day:'Day 4-6',title:'Lo Manthang',desc:'Trek to the walled kingdom. Explore royal palace and Thubchen Gompa with ancient murals.'},{day:'Day 7-8',title:'Sky Caves',desc:'Visit Chhoser sky cave complex — ancient burial chambers carved into cliff faces.'},{day:'Day 9-12',title:'Return',desc:'Alternate eastern return route. Fly from Jomsom to Pokhara.'}]
    },
    { id:9, name:'Paragliding Pokhara', category:'adventure', icon:'🪂', image_url:'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=900&q=80', description:'Glide over Phewa Lake with Annapurna and Dhaulagiri as your backdrop — one of the world\'s most scenic paragliding experiences.', best_time:'Oct-May', duration:'1 day', difficulty:'Easy', altitude:'1,500m', region:'Gandaki Province', nearest_city:'Pokhara', is_featured:1,
      highlights:['Tandem Flight','Himalayan Backdrop','Aerial Photography','Sarangkot Launch','Lake Landing','Acrobatic Options'],
      why_visit:['Top 5 paragliding spot in the world — fly with Himalayan vultures with Annapurna as your backdrop.','No experience required — certified tandem pilots handle everything.','30-60 minute flights with optional acrobatic maneuvers.','Launch from Sarangkot (1,592m) and land on Phewa Lake shore.'],
      activities:['🪂 Tandem paragliding','📸 In-air GoPro','🎢 Acrobatic maneuvers','🌄 Sarangkot launch','🦅 Soaring with vultures','🏋️ Safety training','🎖️ Flight certificate','🎥 Video package'],
      itinerary:[{day:'Day 1',title:'Paragliding Experience',desc:'Morning pickup. Drive to Sarangkot launch (1,592m). Safety briefing. Soar over Phewa Lake with Annapurna views. Professional photo/video package. Lakeside landing.'}]
    },
    { id:10, name:'Lumbini – Birthplace of Buddha', category:'culture', icon:'🌸', image_url:'https://images.unsplash.com/photo-1559628376-f3fe5f782a2a?w=900&q=80', description:'UNESCO World Heritage Site marking the exact birthplace of Siddhartha Gautama (Buddha). Sacred gardens, Maya Devi Temple and international monastery zone.', best_time:'Oct-Mar', duration:'1-2 days', difficulty:'Easy', altitude:'150m', region:'Rupandehi, Lumbini', nearest_city:'Bhairahawa', is_featured:0,
      highlights:['Maya Devi Temple','Ashoka Pillar','Monastery Zone','Sacred Garden','Peace Flame','Crane Sanctuary'],
      why_visit:['Stand at the exact birthplace of Siddhartha Gautama — the Maya Devi Temple has the authenticated birth marker stone.','Over 25 countries built stunning national-style monasteries in the monastery zone.','The Ashoka Pillar (249 BCE) is one of the oldest inscribed monuments in South Asia.','A completely different Nepal — flat Terai plains, subtropical warmth, profound peace.'],
      activities:['🕍 Maya Devi Temple','🏛️ Ashoka Pillar','🌳 Sacred Garden walk','🚲 Bicycle monastery tour','🧘 Monastery meditation','🕊️ Peace Flame','📸 Buddhist architecture','🦢 Crane sanctuary birding'],
      itinerary:[{day:'Day 1',title:'Sacred Garden & Maya Devi',desc:'Maya Devi Temple, birth marker stone, Puskarini pond, Ashoka Pillar.'},{day:'Day 2',title:'Monastery Zone',desc:'Bicycle through Thai, Chinese, Korean, Myanmar monasteries. World Peace Pagoda. Lumbini Museum.'}]
    },
    { id:11, name:'Bhaktapur Durbar Square', category:'culture', icon:'🏯', image_url:'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=900&q=80', description:'The best-preserved medieval city in Nepal, famous for its 55-window palace, Nyatapola Temple, and the legendary Juju Dhau (King Curd).', best_time:'Year-round', duration:'Full day', difficulty:'Easy', altitude:'1,400m', region:'Kathmandu Valley', nearest_city:'Bhaktapur', is_featured:0,
      highlights:['55-Window Palace','Nyatapola Temple','Pottery Square','Juju Dhau','Newari Cuisine','Wood Carvings'],
      why_visit:['A perfectly preserved medieval Newari city unchanged for five centuries.','The 55-Window Palace and five-story Nyatapola Temple are masterpieces of Newari craftsmanship.','Nepal\'s culinary capital — legendary Juju Dhau and authentic Newari meals.','Watch master potters, thangka painters, and wood carvers at work.'],
      activities:['🏛️ 55-Window Palace','⛩️ Nyatapola Temple','🏺 Pottery Square','🍮 Juju Dhau tasting','🎨 Thangka shopping','🪵 Wood carving workshop','📸 Architecture photography','🌅 Sunset at Taumadhi Square'],
      itinerary:[{day:'Day 1',title:'Full Bhaktapur Day',desc:'55-Window Palace, Golden Gate, Nyatapola Temple, Pottery Square, Dattatreya Square. Newari lunch with Juju Dhau.'}]
    },
    { id:12, name:'Trishuli River Rafting', category:'adventure', icon:'🚣', image_url:'https://images.unsplash.com/photo-1530866495561-507c9faab2ed?w=900&q=80', description:'Nepal\'s most accessible whitewater rafting — Class III-IV rapids through a dramatic river gorge just 2 hours from Kathmandu.', best_time:'Oct-Nov, Mar-Jun', duration:'1-2 days', difficulty:'Moderate', altitude:'500m', region:'Nuwakot, Bagmati', nearest_city:'Kathmandu', is_featured:0,
      highlights:['Class III-IV Rapids','River Gorge','Beach Camping','Tropical Forest','Beginner Friendly','Chitwan Combo'],
      why_visit:['Nepal\'s most popular rafting river, just 2 hours from Kathmandu.','Class III-IV rapids with perfect balance of thrills and safety, suitable for beginners.','Stunning tropical river gorge with kingfishers and water buffalo on the banks.','Classic combine: Trishuli + Chitwan for a 3-day Nepal adventure.'],
      activities:['🌊 Class III-IV rafting','🏕️ River beach camping','🍳 Campfire dinner','🦜 Kingfisher birding','🏄 Surfing waves','📸 Gorge photography','🤿 Rapid swimming','🚌 Chitwan combo'],
      itinerary:[{day:'Day 1',title:'Rafting Adventure',desc:'Drive from Kathmandu. Safety briefing. Raft through Snake and Monkey Rapids. Riverside lunch. Campfire dinner.'},{day:'Day 2',title:'Morning Run',desc:'Final morning rapids. Take out at Mugling. Continue to Pokhara or Chitwan.'}]
    },
    { id:13, name:'Swayambhunath Monkey Temple', category:'culture', icon:'🐒', image_url:'https://images.unsplash.com/photo-1605640840605-14ac1855827b?w=900&q=80', description:'Perched on a hilltop with panoramic valley views, this ancient stupa with all-seeing Buddha eyes is home to mischievous monkeys and peaceful rituals.', best_time:'Year-round', duration:'Half day', difficulty:'Easy', altitude:'1,400m', region:'Kathmandu Valley', nearest_city:'Kathmandu', is_featured:0,
      highlights:['365 Steps','Buddha Eyes','Valley Panorama','Holy Monkeys','Prayer Flags','Vajra'],
      why_visit:['Climb 365 steps to one of the world\'s oldest religious sites — over 2,500 years old.','Best panoramic view of the entire Kathmandu Valley on clear days.','Mischievous rhesus monkeys considered holy guardians of the temple.','Sacred to both Buddhists and Hindus — Nepal\'s beautiful religious harmony.'],
      activities:['🧗 365-step staircase','☸️ Prayer wheel spinning','🐒 Monkey watching','📸 Valley panorama','🙏 Morning puja','☕ Hilltop café','🏛️ Monastery meditation','🌄 Sunrise photography'],
      itinerary:[{day:'Day 1',title:'Swayambhunath',desc:'Early morning climb. Stupa with golden spire and Buddha eyes. Circle 108 prayer wheels. Valley views from western terrace.'}]
    },
    { id:14, name:'Sarangkot Sunrise', category:'nature', icon:'🌄', image_url:'https://images.unsplash.com/photo-1571401835393-8c5f35328320?w=900&q=80', description:'Wake at 5am and climb to Sarangkot above Pokhara to watch the sun paint the Annapurna and Dhaulagiri ranges in spectacular golden and pink hues.', best_time:'Oct-May', duration:'Half day', difficulty:'Easy', altitude:'1,592m', region:'Gandaki Province', nearest_city:'Pokhara', is_featured:0,
      highlights:['Mountain Sunrise','Fishtail Peak','Photography','Paragliding Launch','100km Panorama','Easy Access'],
      why_visit:['Arguably the best mountain sunrise in the world — peaks turn from blue to gold.','Just 30 minutes from Pokhara Lakeside — no trekking required, suitable for all ages.','Primary paragliding launch site — combine sunrise with a morning flight.','100km panorama spanning Dhaulagiri to Manaslu on clear days.'],
      activities:['🌄 Himalayan sunrise','📸 Golden hour photography','🪂 Paragliding launch','🍵 Hilltop tea','🚶 Village walk down','🔭 Peak identification','🌅 Sunset option','🏘️ Kaskikot village'],
      itinerary:[{day:'Day 1',title:'Sarangkot Sunrise',desc:'Pre-dawn pickup (5:00am). Drive to Sarangkot (1,592m). Watch sunrise over Annapurna range. Hot tea at café. Option: paragliding or walk through Kaskikot village.'}]
    },
    { id:15, name:'Langtang Valley Trek', category:'trek', icon:'🏕️', image_url:'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=900&q=80', description:'A beautiful, less-crowded alternative to Everest — high-altitude meadows, Tamang villages, Kyanjin Gompa monastery, and views of Langtang Lirung.', best_time:'Oct-Nov, Mar-May', duration:'7-10 days', difficulty:'Moderate', altitude:'3,870m', region:'Rasuwa, Bagmati', nearest_city:'Kathmandu', is_featured:0,
      highlights:['Kyanjin Gompa','Yak Cheese Factory','Tamang Culture','Langtang Lirung Views','Tserko Ri','Bamboo Forests'],
      why_visit:['Just 7 hours from Kathmandu — stunning trekking without flights or expensive permits.','Warm Tamang hospitality with communities rebuilt after the 2015 earthquake.','Famous yak cheese factory at Kyanjin Gompa — some of the finest mountain cheese in Asia.','Uncrowded trails through rhododendron and bamboo forests.'],
      activities:['🥾 Valley trekking','⛪ Kyanjin Gompa','🧀 Yak cheese factory','🐂 Yak meadows','🌺 Rhododendron forests','🏔️ Tserko Ri (5,033m)','🎭 Tamang culture','📿 Monastery prayers'],
      itinerary:[{day:'Day 1-2',title:'Kathmandu to Lama Hotel',desc:'Drive 7 hours to Syabrubesi. Trek along Langtang Khola to Lama Hotel (2,380m).'},{day:'Day 3-4',title:'Into the Valley',desc:'Trek through open terrain with yaks to Langtang Village (3,430m).'},{day:'Day 5-6',title:'Kyanjin Gompa',desc:'Reach Kyanjin Gompa (3,870m). Yak cheese factory. Hike Tserko Ri (5,033m) for panoramic views.'},{day:'Day 7-10',title:'Return',desc:'Descend via alternate trails. Drive back to Kathmandu.'}]
    }
  ];

  for (const d of destinations) {
    w.prepare('INSERT OR IGNORE INTO destinations (id,name,category,icon,image_url,description,best_time,duration,difficulty,altitude,region,nearest_city,is_featured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(d.id,d.name,d.category,d.icon,d.image_url,d.description,d.best_time,d.duration,d.difficulty,d.altitude,d.region,d.nearest_city,d.is_featured);
    d.highlights.forEach(h => w.prepare('INSERT INTO destination_highlights (destination_id,highlight) VALUES (?,?)').run(d.id,h));
    d.why_visit.forEach((r,i) => w.prepare('INSERT INTO why_visit (destination_id,reason,sort_order) VALUES (?,?,?)').run(d.id,r,i));
    d.activities.forEach((a,i) => w.prepare('INSERT INTO activities (destination_id,activity,sort_order) VALUES (?,?,?)').run(d.id,a,i));
    d.itinerary.forEach((it,i) => w.prepare('INSERT INTO itinerary_days (destination_id,day_label,title,description,sort_order) VALUES (?,?,?,?,?)').run(d.id,it.day,it.title,it.desc,i));
  }
  saveToDisk();
}

function getDB() { return global._db; }

module.exports = { initDB, getDB };
