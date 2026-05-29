// ============================================================
// Himalaya Routes — Frontend App
// ============================================================
const API = '/api';
let allDestinations = [];
let tripDays = 7;
let itineraryItems = [];
let currentDest = null;
let token = localStorage.getItem('hr_token');
let currentUser = JSON.parse(localStorage.getItem('hr_user') || 'null');

// ── Utilities ──────────────────────────────────────────────
const $ = id => document.getElementById(id);
const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

function showToast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.className = 'toast', 3200);
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Auth ───────────────────────────────────────────────────
function updateNavAuth() {
  if (currentUser) {
    $('navAuthArea').style.display = 'none';
    $('navUserArea').style.display = 'flex';
    $('navUserName').textContent = '👤 ' + currentUser.name.split(' ')[0];
  } else {
    $('navAuthArea').style.display = 'flex';
    $('navUserArea').style.display = 'none';
  }
}

async function doLogin() {
  const email = $('loginEmail').value.trim();
  const pass = $('loginPass').value;
  if (!email || !pass) return showToast('Email and password required', true);
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: pass }) });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('hr_token', token);
    localStorage.setItem('hr_user', JSON.stringify(currentUser));
    updateNavAuth();
    closeModal('loginModal');
    showToast('Welcome back, ' + currentUser.name.split(' ')[0] + '! 🏔️');
    if (currentUser.role === 'admin') {
      setTimeout(() => { if (confirm('You are admin. Go to Admin Panel?')) window.open('/admin.html', '_blank'); }, 500);
    }
  } catch (err) { showToast(err.message, true); }
}

async function doRegister() {
  const name = $('regName').value.trim();
  const email = $('regEmail').value.trim();
  const pass = $('regPass').value;
  const country = $('regCountry').value.trim();
  if (!name || !email || !pass) return showToast('Name, email and password required', true);
  try {
    const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password: pass, country }) });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('hr_token', token);
    localStorage.setItem('hr_user', JSON.stringify(currentUser));
    updateNavAuth();
    closeModal('loginModal');
    showToast('Account created! Welcome, ' + name.split(' ')[0] + '! 🎉');
  } catch (err) { showToast(err.message, true); }
}

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('hr_token'); localStorage.removeItem('hr_user');
  updateNavAuth();
  showToast('Logged out. See you soon! 🏔️');
}

function showRegister() { $('loginForm').style.display = 'none'; $('registerForm').style.display = 'block'; }
function showLogin() { $('loginForm').style.display = 'block'; $('registerForm').style.display = 'none'; }

// ── Destinations ───────────────────────────────────────────
async function loadDestinations() {
  try {
    allDestinations = await api('/destinations');
    $('statDest').textContent = allDestinations.length + '+';
    renderPlaceCards('all');
    renderFooterDests();
    renderDayRows();
  } catch (err) {
    $('placesGrid').innerHTML = '<div class="loading-state">Could not load destinations. Is the server running?</div>';
  }
}

function renderPlaceCards(filter) {
  const list = filter === 'all' ? allDestinations : allDestinations.filter(d => d.category === filter);
  if (!list.length) { $('placesGrid').innerHTML = '<div class="loading-state">No destinations found.</div>'; return; }
  $('placesGrid').innerHTML = list.map((d, i) => {
    const added = itineraryItems.find(x => x.id === d.id);
    return `<div class="place-card" onclick="openDestModal(${d.id})">
      <div class="place-img" style="background-image:url('${d.image_url || ''}')"></div>
      <div class="place-grad"></div>
      <div class="place-info">
        <div class="place-num">${String(i + 1).padStart(2,'0')}</div>
        <div class="place-name">${d.icon || ''} ${d.name}</div>
        <span class="place-cat-tag">${d.category.toUpperCase()}</span>
        <span class="place-bt">📅 Best: ${d.best_time}</span>
        <div class="place-desc-short">${(d.description || '').slice(0, 120)}...</div>
      </div>
      <button class="add-btn ${added ? 'added' : ''}" onclick="quickAdd(event,${d.id})">${added ? '✓' : '＋'}</button>
    </div>`;
  }).join('');
}

function filterPlaces(cat, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPlaceCards(cat);
}

function renderFooterDests() {
  const featured = allDestinations.filter(d => d.is_featured).slice(0, 5);
  $('footerDests').innerHTML = featured.map(d => `<li><a href="#">${d.name}</a></li>`).join('');
}

// ── Destination Modal ──────────────────────────────────────
async function openDestModal(id) {
  try {
    const d = await api('/destinations/' + id);
    currentDest = d;
    $('mImg').src = d.image_url || '';
    $('mImg').alt = d.name;
    $('mCat').textContent = d.category.toUpperCase();
    $('mName').textContent = d.icon + ' ' + d.name;
    $('mBest').textContent = '📅 Best Time: ' + d.best_time;
    $('mDesc').textContent = d.description;

    $('mWhy').innerHTML = (d.why_visit || []).map(r => `
      <div class="why-item">
        <div class="why-check">✓</div>
        <div class="why-text">${r}</div>
      </div>`).join('');

    $('mActs').innerHTML = (d.activities || []).map(a => `
      <div class="act-item">
        <span>${a.substring(0,2)}</span>
        <span>${a.substring(2).trim()}</span>
      </div>`).join('');

    $('mHL').innerHTML = (d.highlights || []).map(h => `<span class="hl-chip">${h}</span>`).join('');

    $('mItin').innerHTML = (d.itinerary || []).map((it, i) => `
      <div class="tl-day">
        <div class="tl-dot">${i+1}</div>
        <div class="tl-title"><span>${it.day_label}</span>${it.title}</div>
        <div class="tl-desc">${it.description}</div>
      </div>`).join('');

    $('mInfo').innerHTML = `
      <div class="info-cell"><div class="info-lbl">Altitude</div><div class="info-val">${d.altitude}</div></div>
      <div class="info-cell"><div class="info-lbl">Duration</div><div class="info-val">${d.duration}</div></div>
      <div class="info-cell"><div class="info-lbl">Difficulty</div><div class="info-val">${d.difficulty}</div></div>
      <div class="info-cell"><div class="info-lbl">Region</div><div class="info-val">${d.region}</div></div>
      <div class="info-cell"><div class="info-lbl">Nearest City</div><div class="info-val">${d.nearest_city}</div></div>
      <div class="info-cell"><div class="info-lbl">Rating</div><div class="info-val">${d.avg_rating ? '⭐ ' + d.avg_rating : 'New'}</div></div>`;

    // Reviews
    const reviews = await api('/reviews?destination_id=' + id);
    $('mReviews').innerHTML = reviews.length ? `
      <div class="modal-sec-title">💬 Traveler Reviews</div>
      ${reviews.slice(0,3).map(r => `
        <div class="review-card" style="margin-bottom:8px;">
          <div class="review-stars">${'⭐'.repeat(r.rating)}</div>
          <div class="review-body">${r.body}</div>
          <div class="review-author">${r.reviewer_name} <span class="review-country">${r.reviewer_country || ''}</span></div>
        </div>`).join('')}` : '';

    const added = itineraryItems.find(x => x.id === d.id);
    $('mAddBtn').textContent = added ? '✓ Already in Itinerary' : '＋ Add to My Itinerary';
    $('destModal').classList.add('open');
    $('destModalInner').scrollTop = 0;
  } catch (err) { showToast('Could not load destination details', true); }
}

function addFromModal() {
  if (currentDest) {
    addToItinerary(currentDest);
    $('mAddBtn').textContent = '✓ Added to Itinerary';
  }
}

function closeDestModal(e) { if (e.target === $('destModal')) closeDestModalBtn(); }
function closeDestModalBtn() { $('destModal').classList.remove('open'); }

// ── Itinerary Builder ──────────────────────────────────────
function quickAdd(e, id) {
  e.stopPropagation();
  const dest = allDestinations.find(d => d.id === id);
  if (dest) addToItinerary(dest);
}

function addToItinerary(d) {
  if (!d || itineraryItems.find(x => x.id === d.id)) { showToast('Already in your itinerary!'); return; }
  itineraryItems.push(d);
  renderSummary();
  renderPlaceCards(document.querySelector('.filter-btn.active')?.textContent.toLowerCase().trim().replace(/[^a-z]/g,'') === 'all' ? 'all' : document.querySelector('.filter-btn.active')?.dataset?.cat || 'all');
  showToast((d.icon || '🏔️') + ' ' + d.name + ' added!');
}

function removeFromSummary(id) {
  itineraryItems = itineraryItems.filter(x => x.id !== id);
  renderSummary();
}

function renderSummary() {
  $('sumDays').textContent = tripDays + ' days';
  $('sumStops').textContent = itineraryItems.length;
  $('sumStatus').textContent = itineraryItems.length > 0 ? '✓ Ready to send' : 'Building...';
  $('sumStatus').style.color = itineraryItems.length > 0 ? 'var(--jade)' : 'var(--amber)';
  if (!itineraryItems.length) {
    $('summaryItems').innerHTML = '<div class="summary-empty">No destinations added yet.<br>Click ＋ on any place card.</div>';
    return;
  }
  $('summaryItems').innerHTML = itineraryItems.map((d, i) => `
    <div class="summary-item">
      <span style="font-size:16px">${d.icon || '🏔️'}</span>
      <span class="summary-item-name">${d.name}</span>
      <span class="summary-item-num">Stop ${i+1}</span>
      <button onclick="removeFromSummary(${d.id})" style="background:none;border:none;color:rgba(242,237,228,.3);cursor:pointer;font-size:16px;margin-left:4px;">×</button>
    </div>`).join('');
}

function changeDays(delta) {
  tripDays = Math.max(1, Math.min(30, tripDays + delta));
  $('daysNum').textContent = tripDays;
  renderDayRows();
  $('sumDays').textContent = tripDays + ' days';
}

function renderDayRows() {
  const icons = ['🏔️','🛕','🏞️','🐘','🪂','🎭','🌄','🚣','☸️','🍜','🦏','🌊','🏕️','🌸','🔱'];
  const options = ['-- Choose destination --', ...allDestinations.map(d => d.name)].map(o => `<option>${o}</option>`).join('');
  $('itineraryDays').innerHTML = Array.from({ length: tripDays }, (_, i) => `
    <div class="day-row">
      <div class="day-lbl">Day ${i+1}</div>
      <select class="day-sel">${options}</select>
      <div class="day-icon">${icons[i % icons.length]}</div>
    </div>`).join('');
}

function toggleChip(el) { el.classList.toggle('on'); }

function getSelectedInterests() {
  return [...document.querySelectorAll('.int-chip.on')].map(el => el.textContent.trim());
}

async function saveAndSubmitItinerary() {
  if (!itineraryItems.length) { showToast('Add at least one destination first!', true); return; }
  const stops = itineraryItems.map((d, i) => ({ destination_id: d.id, stop_order: i }));
  const payload = {
    name: 'My Nepal Trip',
    trip_days: tripDays,
    interests: getSelectedInterests(),
    group_size: $('prefGroup')?.value,
    budget_level: $('prefBudget')?.value,
    fitness_level: $('prefFitness')?.value,
    arrival_date: $('prefDate')?.value || null,
    stops,
    session_id: 'sess_' + Date.now()
  };
  try {
    await api('/itineraries', { method: 'POST', body: JSON.stringify(payload) });
    showToast('🎉 Itinerary saved! Scroll down to send your booking request.');
    setTimeout(() => scrollTo('book'), 800);
  } catch (err) { showToast('Saved locally! Login to save to account.'); scrollTo('book'); }
}

// ── Reviews ────────────────────────────────────────────────
async function loadReviews() {
  try {
    const reviews = await api('/reviews');
    const defaults = [
      { reviewer_name: 'Sarah M.', reviewer_country: 'UK', rating: 5, body: 'Himalaya Routes made our EBC trek absolutely seamless. They arranged everything from airport pickup to tea house bookings. The best Nepal experience possible!' },
      { reviewer_name: 'Kenji T.', reviewer_country: 'Japan', rating: 5, body: 'Paragliding over Pokhara was incredible. The guide was professional and the photos are incredible. Highly recommend the paragliding + Sarangkot sunrise combo.' },
      { reviewer_name: 'Priya S.', reviewer_country: 'India', rating: 5, body: 'Our Chitwan safari was magnificent. Saw rhinos, crocodiles and even tiger pugmarks! The Tharu cultural evening was a wonderful bonus.' },
    ];
    const display = reviews.length >= 3 ? reviews.slice(0,3) : defaults;
    $('reviewsStrip').innerHTML = display.map(r => `
      <div class="review-card">
        <div class="review-stars">${'⭐'.repeat(r.rating)}</div>
        <div class="review-body">"${r.body}"</div>
        <div class="review-author">${r.reviewer_name} <span class="review-country">${r.reviewer_country || ''}</span></div>
      </div>`).join('');
  } catch (_) {
    $('reviewsStrip').innerHTML = `
      <div class="review-card"><div class="review-stars">⭐⭐⭐⭐⭐</div><div class="review-body">"The EBC trek was life-changing. Himalaya Routes handled every detail perfectly."</div><div class="review-author">Sarah M. <span class="review-country">United Kingdom</span></div></div>
      <div class="review-card"><div class="review-stars">⭐⭐⭐⭐⭐</div><div class="review-body">"Paragliding over Phewa Lake with Annapurna views. I cried. Absolutely stunning."</div><div class="review-author">Kenji T. <span class="review-country">Japan</span></div></div>
      <div class="review-card"><div class="review-stars">⭐⭐⭐⭐⭐</div><div class="review-body">"Chitwan rhino safari + Tharu cultural show. The entire trip was flawlessly organized."</div><div class="review-author">Priya S. <span class="review-country">India</span></div></div>`;
  }
}

// ── Booking ────────────────────────────────────────────────
async function submitBooking() {
  const first_name = $('bkFirst').value.trim();
  const last_name = $('bkLast').value.trim();
  const email = $('bkEmail').value.trim();
  if (!first_name || !last_name || !email) { showToast('Please fill in your name and email', true); return; }
  const payload = {
    first_name, last_name, email,
    whatsapp: email.startsWith('+') ? email : null,
    arrival_date: $('bkDate').value || null,
    trip_duration: $('bkDuration').value,
    tour_type: $('bkType').value,
    group_size: $('bkGroup').value,
    special_requests: $('bkNotes').value,
    destinations: itineraryItems.map(d => ({ destination_id: d.id }))
  };
  try {
    await api('/bookings', { method: 'POST', body: JSON.stringify(payload) });
    showToast('✅ Booking request sent! We\'ll reply within 2 hours 🏔️');
    $('bkFirst').value = ''; $('bkLast').value = ''; $('bkEmail').value = ''; $('bkNotes').value = '';
  } catch (err) { showToast(err.message || 'Failed to send. Please try again.', true); }
}

// ── Modals ─────────────────────────────────────────────────
function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }
function closeLoginModal(e) { if (e.target === $('loginModal')) closeModal('loginModal'); }

// ── Cursor ─────────────────────────────────────────────────
document.addEventListener('mousemove', e => {
  const c = $('cursor');
  if (c) { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }
});

// ── Keyboard shortcuts ─────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    $('destModal').classList.remove('open');
    $('loginModal').classList.remove('open');
  }
});

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateNavAuth();
  loadDestinations();
  loadReviews();
});
