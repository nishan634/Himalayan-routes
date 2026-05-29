# 🏔️ Himalaya Routes — Nepal Tourism Full-Stack App

A complete full-stack Nepal tourism web application with Node.js/Express backend, SQLite database, and a beautiful frontend.

---

## 🚀 Quick Start

### Requirements
- **Node.js** v16 or higher  
- **npm** v8 or higher

### Installation

```bash
# 1. Go to the backend folder
cd backend

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

Open your browser at → **http://localhost:3000**  
Admin panel → **http://localhost:3000/admin.html**

---





---

## 📁 Project Structure

```
himalaya_routes/
├── backend/
│   ├── server.js              # Express app entry point
│   ├── package.json           # Dependencies
│   ├── .env                   # Environment config
│   ├── database/
│   │   └── init.js            # DB setup, tables & seed data
│   ├── routes/
│   │   ├── auth.js            # Register, login, profile
│   │   ├── destinations.js    # CRUD for destinations
│   │   ├── bookings.js        # Booking inquiries
│   │   ├── itineraries.js     # Custom trip itineraries
│   │   ├── reviews.js         # Traveler reviews
│   │   ├── contact.js         # Contact messages
│   │   └── admin.js           # Admin dashboard data
│   └── middleware/
│       └── auth.js            # JWT auth middleware
└── frontend/
    └── public/
        ├── index.html         # Main website
        ├── admin.html         # Admin dashboard
        ├── css/
        │   └── style.css      # All styles
        └── js/
            └── app.js         # Frontend logic & API calls
```

---

## 🗄️ Database

Uses **SQLite** via `sql.js` (pure JavaScript — no native compilation needed).

The database file is created automatically at `backend/database/himalaya_routes.db`.

### Tables

| Table                     | Purpose                          |
|--------------------------|----------------------------------|
| `users`                  | Registered users & admins        |
| `destinations`           | Tourist destinations (15 seeded) |
| `destination_highlights` | Highlights per destination       |
| `why_visit`              | Reasons to visit per destination |
| `activities`             | Things to do per destination     |
| `itinerary_days`         | Sample itinerary per destination |
| `bookings`               | Booking inquiries from website   |
| `booking_destinations`   | Destinations per booking         |
| `itineraries`            | Custom user-built itineraries    |
| `itinerary_stops`        | Stops in custom itineraries      |
| `reviews`                | Traveler reviews (with approval) |
| `contact_messages`       | Contact form submissions         |
| `audit_log`              | Admin action log                 |

---

## 🌐 API Endpoints

### Auth
| Method | Path                  | Description          |
|--------|-----------------------|----------------------|
| POST   | `/api/auth/register`  | Create account       |
| POST   | `/api/auth/login`     | Login & get JWT      |
| GET    | `/api/auth/me`        | Get current user     |
| PUT    | `/api/auth/profile`   | Update profile       |

### Destinations
| Method | Path                     | Auth   | Description            |
|--------|--------------------------|--------|------------------------|
| GET    | `/api/destinations`      | Public | List all destinations  |
| GET    | `/api/destinations/:id`  | Public | Full destination detail|
| POST   | `/api/destinations`      | Admin  | Create destination     |
| PUT    | `/api/destinations/:id`  | Admin  | Update destination     |
| DELETE | `/api/destinations/:id`  | Admin  | Deactivate destination |

### Bookings
| Method | Path                          | Auth  | Description           |
|--------|-------------------------------|-------|-----------------------|
| POST   | `/api/bookings`               | Guest | Submit booking inquiry|
| GET    | `/api/bookings`               | User  | My bookings / all     |
| PUT    | `/api/bookings/:id/status`    | Admin | Update booking status |

### Itineraries
| Method | Path                   | Auth  | Description        |
|--------|------------------------|-------|--------------------|
| POST   | `/api/itineraries`     | Guest | Save itinerary     |
| GET    | `/api/itineraries`     | User  | My itineraries     |
| GET    | `/api/itineraries/:id` | Guest | Get by ID          |

### Reviews
| Method | Path                        | Auth  | Description       |
|--------|-----------------------------|-------|-------------------|
| GET    | `/api/reviews`              | Public| List reviews      |
| POST   | `/api/reviews`              | Guest | Submit review     |
| PUT    | `/api/reviews/:id/approve`  | Admin | Approve review    |

### Contact & Admin
| Method | Path                    | Auth  | Description           |
|--------|-------------------------|-------|-----------------------|
| POST   | `/api/contact`          | Guest | Send contact message  |
| GET    | `/api/admin/dashboard`  | Admin | Dashboard stats       |
| GET    | `/api/admin/users`      | Admin | All users             |

---

## ⚙️ Configuration (.env)

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your_super_secret_key_here
DB_PATH=./database/himalaya_routes.db
ADMIN_EMAIL=admin@himalayanroutes.com
ADMIN_PASSWORD=Admin@123
```

---

## 🎨 Features

### Frontend (index.html)
- 🏔️ Full-page hero with animated mountain silhouette
- 🗓️ Best time to visit — 4-season breakdown
- 🗺️ 15 destinations with category filters
- 🔍 Click-through modal with: why visit, things to do, highlights, sample itinerary, reviews
- 🧳 Drag-and-drop itinerary builder with day selector
- 📋 Booking inquiry form (saved to DB)
- 🔐 User auth (login/register with JWT)
- 📱 Fully responsive

### Admin Panel (admin.html)
- 📊 Dashboard with live stats
- 📋 Booking management (update status, price, notes)
- 🏔️ Destination overview
- 👥 User management (assign admin role)
- 🗺️ Itinerary viewer
- ⭐ Review moderation (approve/reject)
- 💬 Contact message reader

---

## 🛠️ Development

```bash
# Run with auto-reload
cd backend
npm run dev   # uses nodemon
```

---

## 📦 Dependencies

| Package          | Purpose                      |
|-----------------|------------------------------|
| express          | Web framework                |
| sql.js           | Pure-JS SQLite (no compile)  |
| bcryptjs         | Password hashing             |
| jsonwebtoken     | JWT auth tokens              |
| cors             | Cross-origin requests        |
| helmet           | Security headers             |
| express-rate-limit| API rate limiting           |
| morgan           | Request logging              |
| dotenv           | Environment variables        |

---

## 📞 Default Contact Info

Update these in `frontend/public/index.html` footer:
- Email: `info@himalayanroutes.com`
- WhatsApp: `+977 980 000 0000`
- Address: `Thamel, Kathmandu`

---

*Built with ♥ in Nepal 🇳🇵*
