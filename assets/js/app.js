
/* Simple client-side "fork" logic using localStorage */
const STORE_KEY = "pothole_reports_v1";
const USERS_KEY = "pothole_users_v1";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function getReports() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch { return []; }
}
function saveReports(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); } catch { return []; }
}
function saveUsers(list) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
}

/* Auth (very basic demo) */
function registerUser({name, email, password}) {
  const users = getUsers();
  if (users.find(u => u.email === email)) throw new Error("Email already registered");
  users.push({ id: uid(), name, email, password });
  saveUsers(users);
  sessionStorage.setItem("auth_email", email);
  return true;
}
function loginUser({email, password}) {
  const users = getUsers();
  const u = users.find(x => x.email === email && x.password === password);
  if (!u) throw new Error("Invalid credentials");
  sessionStorage.setItem("auth_email", email);
  return true;
}
function currentUser() {
  const email = sessionStorage.getItem("auth_email");
  const users = getUsers();
  return users.find(u => u.email === email) || null;
}
function logout() {
  sessionStorage.removeItem("auth_email");
  window.location.href = "index.html";
}

/* Map helper with Leaflet (if available on page) */
function initPickerMap(containerId, onPick) {
  if (typeof L === "undefined") return;
  const map = L.map(containerId).setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
  let marker;
  function setMarker(latlng) {
    if (marker) marker.remove();
    marker = L.marker(latlng).addTo(map);
    onPick(latlng);
  }
  map.on('click', (e) => setMarker(e.latlng));
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos)=>{
      const {latitude, longitude} = pos.coords;
      map.setView([latitude, longitude], 13);
      setMarker({lat: latitude, lng: longitude});
    }, ()=>{});
  }
  return map;
}

/* File to base64 */
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Page initializers */
async function initUploadPage() {
  const form = document.getElementById("report-form");
  const latInput = document.getElementById("lat");
  const lngInput = document.getElementById("lng");
  const mapEl = document.getElementById("map");
  initPickerMap("map", (ll)=>{
    latInput.value = ll.lat.toFixed(6);
    lngInput.value = ll.lng.toFixed(6);
  });

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const title = form.title.value.trim();
    const desc = form.description.value.trim();
    const email = (currentUser()?.email) || form.email.value.trim();
    const severity = form.severity.value;
    const file = form.photo.files[0];
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);

    if (!title || !desc || !email || !file || isNaN(lat) || isNaN(lng)) {
      alert("Please complete all fields and pick a location on the map.");
      return;
    }
    const img = await fileToDataURL(file);
    const reports = getReports();
    reports.unshift({
      id: uid(), title, desc, email, severity, img, lat, lng,
      createdAt: Date.now(), status: "Open", votes: 0
    });
    saveReports(reports);
    form.reset();
    alert("Pothole reported! View it in the Gallery.");
    window.location.href = "gallery.html";
  });
}

function initGalleryPage() {
  const grid = document.getElementById("gallery-grid");
  const reports = getReports();
  grid.innerHTML = "";
  if (!reports.length) {
    grid.innerHTML = `<div class="alert">No reports yet. Be the first to <a href="upload.html">upload a pothole</a>!</div>`;
    return;
  }
  for (const r of reports) {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <img src="${r.img}" alt="${r.title}"/>
      <div class="meta">
        <div>
          <div style="font-weight:700">${r.title}</div>
          <small class="muted">${new Date(r.createdAt).toLocaleString()}</small>
        </div>
        <span class="tag">${r.severity}</span>
      </div>
    `;
    grid.appendChild(item);
  }
}

function initLeaderboardPage() {
  const tbody = document.getElementById("lb-body");
  const reports = getReports();
  const byUser = new Map();
  for (const r of reports) {
    byUser.set(r.email, (byUser.get(r.email)||0)+1);
  }
  const rows = [...byUser.entries()].sort((a,b)=>b[1]-a[1]);
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="3">No data yet.</td></tr>`;
    return;
  }
  let rank = 1;
  tbody.innerHTML = rows.map(([email,count])=>{
    return `<tr><td>#${rank++}</td><td>${email}</td><td>${count}</td></tr>`
  }).join("");
}

function initAuthPage(kind) {
  const form = document.getElementById(kind+"-form");
  const error = document.getElementById("auth-error");
  form.addEventListener("submit", (e)=>{
    e.preventDefault();
    error.textContent = "";
    try {
      if (kind === "register") {
        registerUser({ name: form.name.value.trim(), email: form.email.value.trim(), password: form.password.value });
      } else {
        loginUser({ email: form.email.value.trim(), password: form.password.value });
      }
      window.location.href = "index.html";
    } catch (err) {
      error.textContent = err.message;
    }
  });
}

function renderKpis() {
  const reports = getReports();
  const total = reports.length;
  const open = reports.filter(r=>r.status==="Open").length;
  const severe = reports.filter(r=>r.severity==="Severe").length;
  const users = new Set(reports.map(r=>r.email)).size;
  const set = (id, v)=> document.getElementById(id).textContent = v;
  set("k-total", total);
  set("k-open", open);
  set("k-severe", severe);
  set("k-users", users);
}

window.IP = {
  initUploadPage,
  initGalleryPage,
  initLeaderboardPage,
  initAuthPage,
  renderKpis,
  logout,
  currentUser
};
