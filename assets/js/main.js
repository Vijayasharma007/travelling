/* ============================================================
   Gurudev Travels — front-end logic
   - Innova fleet (replaceable images)
   - Pick pickup/drop on an interactive OpenStreetMap (Leaflet) — no API key (tap / drag / search)
   - Submit -> opens WhatsApp with the full booking (sent to your number)
   - Live "View route on Google Maps" link
   - Optional Google Apps Script / Google Sheet save (background)
   - Dark/Light toggle, scroll reveal, success modal
   ============================================================ */

/* ===================== CONFIG ===================== */

// 🔧 1) The CAB OWNER's WhatsApp number — receives every new booking (digits only, with country code).
const OWNER_WHATSAPP = "919688211890"; // +91 96882 11890
//        (the CUSTOMER's number is taken from the booking form's phone field)

// 🔧 2) Maps are 100% free & open-source — OpenStreetMap + Leaflet + Nominatim.
//        NO API KEY NEEDED. Nothing to configure here. 🎉

// 🔧 3) Optional Apps Script URL to also save bookings to a Google Sheet (leave PASTE_ to skip).
const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

// 🔧 4) Where the map opens by default before a location is chosen (lat,lng + zoom).
const DEFAULT_MAP_CENTER = { lat: 11.1271, lng: 78.6569 }; // Tamil Nadu, India
const DEFAULT_MAP_ZOOM = 7;

// 🔧 5) Your Innova fleet. Put photos in assets/img/ and update `img` (missing -> 🚙 placeholder).
const FLEET = [
  { id:"crysta",  img:"assets/img/crysta.jpg",  name:"Innova Crysta",          seats:7, bags:4, fare:"₹18/km", tag:"Most popular",     badge:"jade",
    desc:"The classic premium 7-seater. Smooth ride, captain seats, perfect for families & outstation." },
  { id:"hycross", img:"assets/img/hycross.jpg", name:"Innova Hycross",         seats:7, bags:4, fare:"₹22/km", tag:"Hybrid · premium", badge:"brand",
    desc:"Latest hybrid Innova — quieter, fuel-efficient and plush. The flagship of our fleet." },
  { id:"crysta8", img:"assets/img/crysta8.jpg", name:"Innova Crysta (8-seat)", seats:8, bags:3, fare:"₹20/km", tag:"Big groups",       badge:"brand",
    desc:"8-seater bench layout for larger groups who need an extra seat for the journey." },
];

/* ===================== HELPERS ===================== */

const $ = (id) => document.getElementById(id);
const todayStr = () => new Date().toISOString().split("T")[0];
const isConfigured = () => API_URL && !API_URL.startsWith("PASTE_");
const show = (id) => $(id)?.classList.remove("hidden");
const hide = (id) => $(id)?.classList.add("hidden");
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function mapsRouteUrl(from, to){
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}`;
}

const RULE = "----------------------------";

// Message the CAB OWNER receives (a new booking has come in).
function buildOwnerMessage(b){
  const lines = [
    "*GURUDEV TRAVELS*",
    "New Booking Request",
    RULE,
    `Name        : ${b.name}`,
    `Phone       : ${b.phone}`,
    `Car         : ${b.car}`,
    `Pickup      : ${b.pickup}`,
    `Drop        : ${b.drop}`,
    `From        : ${b.dateFrom}`,
    `To          : ${b.dateTo}`,
    `Passengers  : ${b.passengers}`,
    RULE,
  ];
  if (b.pickup && b.drop) lines.push(`Route map: ${mapsRouteUrl(b.pickup, b.drop)}`);
  return lines.join("\n");
}

// Message the CUSTOMER receives (their booking is confirmed).
function buildCustomerMessage(b){
  return [
    "*GURUDEV TRAVELS*",
    "Booking Confirmed",
    RULE,
    `Hi ${b.name}, thank you for booking with us.`,
    "",
    `Car         : ${b.car}`,
    `Pickup      : ${b.pickup}`,
    `Drop        : ${b.drop}`,
    `From        : ${b.dateFrom}`,
    `To          : ${b.dateTo}`,
    `Passengers  : ${b.passengers}`,
    RULE,
    "Your driver's details will be shared before pickup.",
    "For any help, just reply to this message.",
    "",
    "Gurudev Travels - Safe & comfortable journeys",
  ].join("\n");
}

function whatsappLink(message, to){
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

/* ===================== THEME ===================== */
(function initTheme(){
  const saved = localStorage.getItem("wander-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && prefersDark)) document.documentElement.classList.add("dark");
})();

/* ===================== FLEET ===================== */
function renderFleet(){
  $("fleetGrid").innerHTML = FLEET.map(c => `
    <article class="car-card reveal">
      <img src="${c.img}" alt="${escapeHtml(c.name)}" class="car-img"
           onerror="this.classList.add('img-fallback'); this.removeAttribute('src');" />
      <div class="p-5">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-lg font-bold">${escapeHtml(c.name)}</h3>
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-${c.badge}-100 text-${c.badge}-700 dark:bg-${c.badge}-900/40 dark:text-${c.badge}-300 whitespace-nowrap">${escapeHtml(c.tag)}</span>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">${escapeHtml(c.desc)}</p>
        <div class="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          <span class="spec">👥 ${c.seats} seats</span>
          <span class="spec">🧳 ${c.bags} bags</span>
          <span class="spec">❄️ AC</span>
          <span class="spec font-semibold text-brand-600 dark:text-brand-300">${escapeHtml(c.fare)}</span>
        </div>
        <button data-book="${c.id}" class="mt-5 w-full rounded-xl py-3 font-semibold text-white bg-gradient-to-r from-brand-600 to-jade-500 shadow-glow hover:opacity-95 transition">Book this car</button>
      </div>
    </article>`).join("");

  $("car").innerHTML = FLEET.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)} · ${c.seats} seats · ${escapeHtml(c.fare)}</option>`).join("");

  document.querySelectorAll("[data-book]").forEach(btn => btn.addEventListener("click", () => {
    const car = FLEET.find(c => c.id === btn.dataset.book);
    if (car) $("car").value = car.name;
    $("booking").scrollIntoView({ behavior:"smooth" });
  }));
}

/* ===================== OPEN-SOURCE MAPS (Leaflet + OpenStreetMap + Nominatim) ===================== */
// No API key needed. Geocoding/search via the free Nominatim service.
const NOMINATIM = "https://nominatim.openstreetmap.org";

// Free-form place search -> array of results [{display_name, lat, lon}]
async function geocodeSearch(query){
  if (!query || query.trim().length < 3) return [];
  try {
    const url = `${NOMINATIM}/search?format=jsonv2&limit=5&addressdetails=0&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers:{ "Accept":"application/json" } });
    return await res.json();
  } catch (e) { console.warn("Search failed:", e); return []; }
}

// Coordinates -> human address
async function reverseGeocode(lat, lon){
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers:{ "Accept":"application/json" } });
    const d = await res.json();
    return d && d.display_name ? d.display_name : null;
  } catch (e) { console.warn("Reverse geocode failed:", e); return null; }
}

// Simple debounce so we respect Nominatim's ~1 request/second policy.
function debounce(fn, ms){ let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/* ----- Typing suggestions on the pickup/drop fields (free, via <datalist>) ----- */
function initOsmAutocomplete(){
  [["pickup","pickupList"], ["drop","dropList"]].forEach(([inputId, listId]) => {
    const input = $(inputId), list = document.getElementById(listId);
    const run = debounce(async () => {
      const results = await geocodeSearch(input.value);
      list.innerHTML = results.map(r => `<option value="${r.display_name.replace(/"/g,"&quot;")}"></option>`).join("");
    }, 500);
    input.addEventListener("input", () => { updateMapLink(); run(); });
  });
}

/* ----- Map picker modal (Leaflet) ----- */
const LEAFLET_ICON = (typeof L !== "undefined") ? L.icon({
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34], shadowSize:[41,41],
}) : null;

let pmap, pmarker, mapBuilt = false, mapTargetField = null, pickedAddress = "";

function buildPickerMap(){
  pmap = L.map("mapCanvas").setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], DEFAULT_MAP_ZOOM);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap contributors",
  }).addTo(pmap);
  pmarker = L.marker([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], { draggable:true, icon:LEAFLET_ICON }).addTo(pmap);

  pmap.on("click", (e) => setPicked(e.latlng.lat, e.latlng.lng));
  pmarker.on("dragend", () => { const ll = pmarker.getLatLng(); setPicked(ll.lat, ll.lng); });

  // Search box inside the modal -> results list
  const results = $("mapResults");
  const run = debounce(async () => {
    const list = await geocodeSearch($("mapSearch").value);
    if (!list.length){ results.classList.add("hidden"); results.innerHTML = ""; return; }
    results.innerHTML = list.map((r, i) =>
      `<li data-i="${i}" data-lat="${r.lat}" data-lon="${r.lon}">${r.display_name}</li>`).join("");
    results.classList.remove("hidden");
    results.querySelectorAll("li").forEach(li => li.addEventListener("click", () => {
      const lat = parseFloat(li.dataset.lat), lon = parseFloat(li.dataset.lon);
      pmap.setView([lat, lon], 15);
      setPicked(lat, lon, li.textContent);
      results.classList.add("hidden");
      $("mapSearch").value = li.textContent;
    }));
  }, 500);
  $("mapSearch").addEventListener("input", run);

  mapBuilt = true;
}

async function setPicked(lat, lon, knownAddr){
  pmarker.setLatLng([lat, lon]);
  $("mapConfirm").disabled = false;
  if (knownAddr){ pickedAddress = knownAddr; $("mapPickedAddr").textContent = knownAddr; return; }
  $("mapPickedAddr").textContent = "Locating…";
  pickedAddress = await reverseGeocode(lat, lon) || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  $("mapPickedAddr").textContent = pickedAddress;
}

function openMapPicker(field){
  if (typeof L === "undefined"){
    alert("Map library is still loading — please try again in a moment, or type the location.");
    $(field).focus();
    return;
  }
  mapTargetField = field;
  pickedAddress = "";
  $("mapModalTitle").textContent = field === "pickup" ? "📍 Select pickup location" : "🏁 Select drop location";
  $("mapSearch").value = "";
  $("mapResults").classList.add("hidden");
  $("mapPickedAddr").textContent = "—";
  $("mapConfirm").disabled = true;
  show("mapModal");

  if (!mapBuilt) buildPickerMap();

  // Leaflet needs a size refresh once the modal is visible.
  setTimeout(async () => {
    pmap.invalidateSize();
    const existing = $(field).value.trim();
    if (existing){
      const r = (await geocodeSearch(existing))[0];
      if (r){ const lat = parseFloat(r.lat), lon = parseFloat(r.lon); pmap.setView([lat, lon], 14); setPicked(lat, lon, r.display_name); }
    } else if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        (pos) => { const { latitude:lat, longitude:lon } = pos.coords; pmap.setView([lat, lon], 14); setPicked(lat, lon); },
        () => { pmap.setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], DEFAULT_MAP_ZOOM); }
      );
    }
  }, 250);
}

function initMapPicker(){
  document.querySelectorAll(".map-pick-btn").forEach(btn =>
    btn.addEventListener("click", () => openMapPicker(btn.dataset.target)));
  $("mapClose").addEventListener("click", () => hide("mapModal"));
  $("mapModal").addEventListener("click", (e) => { if (e.target.id === "mapModal") hide("mapModal"); });
  $("mapConfirm").addEventListener("click", () => {
    if (mapTargetField && pickedAddress){ $(mapTargetField).value = pickedAddress; updateMapLink(); }
    hide("mapModal");
  });
}

function updateMapLink(){
  const from = $("pickup").value.trim(), to = $("drop").value.trim();
  const link = $("mapLink");
  if (from && to){ link.href = mapsRouteUrl(from, to); link.classList.remove("hidden"); link.classList.add("flex"); }
  else { link.classList.add("hidden"); link.classList.remove("flex"); }
}

/* ===================== BOOKING FORM ===================== */
function initBookingForm(){
  const from = $("dateFrom"), to = $("dateTo");
  from.min = todayStr(); to.min = todayStr();
  from.addEventListener("change", () => {
    to.min = from.value || todayStr();
    if (to.value && to.value < from.value) to.value = from.value;
  });

  $("pickup").addEventListener("input", updateMapLink);
  $("drop").addEventListener("input", updateMapLink);

  $("bookingForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const err = $("formError"); err.classList.add("hidden");
    const b = {
      name: $("name").value.trim(), car: $("car").value,
      pickup: $("pickup").value.trim(), drop: $("drop").value.trim(),
      dateFrom: $("dateFrom").value, dateTo: $("dateTo").value,
      passengers: $("passengers").value, phone: $("phone").value.trim(),
    };

    if (!b.name || !b.pickup || !b.drop || !b.dateFrom || !b.dateTo || !b.phone)
      return showError(err, "Please fill in all fields.");
    if (b.pickup.toLowerCase() === b.drop.toLowerCase())
      return showError(err, "Pickup and drop points can't be the same.");
    if (b.dateTo < b.dateFrom)
      return showError(err, "The 'To' date must be after the 'From' date.");
    if (!/^[0-9]{10,15}$/.test(b.phone))
      return showError(err, "Enter a valid WhatsApp number (digits only, with country code).");

    // Build both notifications.
    const ownerUrl    = whatsappLink(buildOwnerMessage(b), OWNER_WHATSAPP);
    const customerUrl = whatsappLink(buildCustomerMessage(b), b.phone);

    // Open the OWNER's WhatsApp immediately (synchronous = no popup block) so they're notified.
    window.open(ownerUrl, "_blank");

    showSuccess(b, ownerUrl, customerUrl);
    resetForm(e.target);

    // ---- Backend: save to Sheet + (if Cloud API configured) auto-send BOTH WhatsApp messages ----
    if (isConfigured()){
      fetch(API_URL, {
        method:"POST",
        headers:{ "Content-Type":"text/plain;charset=utf-8" },
        body: JSON.stringify({ action:"create", booking:b }),
      }).catch((ex) => console.warn("Backend call failed:", ex));
    }
  });

  $("closeModal").addEventListener("click", () => hide("successModal"));
  $("successModal").addEventListener("click", (e) => { if (e.target.id === "successModal") hide("successModal"); });
}

function resetForm(form){ form.reset(); $("passengers").value = 2; updateMapLink(); }
function showError(el, msg){ el.textContent = msg; el.classList.remove("hidden"); }
function showSuccess(b, ownerUrl, customerUrl){
  $("modalSummary").innerHTML = `
    <div class="flex justify-between gap-4"><span class="text-slate-400">Car</span><span class="font-semibold text-right">${escapeHtml(b.car)}</span></div>
    <div class="flex justify-between gap-4"><span class="text-slate-400">Route</span><span class="font-semibold text-right">${escapeHtml(b.pickup)} → ${escapeHtml(b.drop)}</span></div>
    <div class="flex justify-between gap-4"><span class="text-slate-400">Dates</span><span class="font-semibold text-right">${b.dateFrom} → ${b.dateTo}</span></div>
    <div class="flex justify-between gap-4"><span class="text-slate-400">Passengers</span><span class="font-semibold">${escapeHtml(b.passengers)}</span></div>
    <div class="flex justify-between gap-4"><span class="text-slate-400">Name</span><span class="font-semibold text-right">${escapeHtml(b.name)}</span></div>
    <a href="${mapsRouteUrl(b.pickup, b.drop)}" target="_blank" rel="noopener" class="block pt-1 text-brand-600 dark:text-brand-300 font-semibold hover:underline">🗺️ View route on Google Maps</a>`;
  $("waOwnerBtn").href = ownerUrl;
  $("waCustomerBtn").href = customerUrl;
  show("successModal");
}

/* ===================== CONTACT ===================== */
function initContact(){
  $("phoneLink").href = whatsappLink("Hi Gurudev Travels! 👋", OWNER_WHATSAPP);
  $("contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = `Hi Gurudev Travels! 👋\n\nName: ${$("cName").value.trim()}\nMessage: ${$("cMsg").value.trim()}`;
    window.open(whatsappLink(text, OWNER_WHATSAPP), "_blank");
  });
}

/* ===================== SCROLL REVEAL ===================== */
function initReveal(){
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => { if (en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold:0.15 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
}

/* ===================== NAVBAR + SCROLL-UP ===================== */
function initScrollUi(){
  const nav = $("navbar");
  const up = document.querySelector(".scrollup");
  const onScroll = () => {
    const y = window.scrollY;
    nav?.classList.toggle("nav-scrolled", y > 60);
    up?.classList.toggle("show", y > 400);
  };
  window.addEventListener("scroll", onScroll, { passive:true });
  onScroll();
}

/* ===================== SUBSCRIBE (optional) ===================== */
function initSubscribe(){
  const f = document.getElementById("subscribeForm");
  if (!f) return;
  f.addEventListener("submit", (e) => { e.preventDefault(); f.reset(); alert("Thanks for subscribing! 🎉 We'll send offers your way."); });
}

/* ===================== BOOT ===================== */
document.addEventListener("DOMContentLoaded", () => {
  $("year").textContent = new Date().getFullYear();
  $("themeToggle").addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("wander-theme", isDark ? "dark" : "light");
  });
  renderFleet();
  initBookingForm();
  initMapPicker();
  initOsmAutocomplete();
  initContact();
  initReveal();
  initScrollUi();
  initSubscribe();
});
