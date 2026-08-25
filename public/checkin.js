const $ = s => document.querySelector(s);
const eventId = window.location.pathname.split('/')[2];
let searchTimer;
let lastResults = [];
let eventData = null;

// Shape sizes match the planner's floor plan (public/floorplan.js) so the
// guide is drawn to the same proportions as what the host arranged.
const TABLE_W = 170, TABLE_H = 170, RECT_W = 220, RECT_H = 110;
const MARKER_W = 90, MARKER_H = 70;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

async function api(url, opt = {}) {
  const r = await fetch(url, opt);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}

async function searchGuests(query) {
  if (!query.trim()) {
    $("#searchResults").innerHTML = "";
    return;
  }
  
  try {
    const guests = await api(`/api/events/${eventId}/guest?q=${encodeURIComponent(query)}`);
    lastResults = guests;
    
    if (guests.length === 0) {
      $("#searchResults").innerHTML = '<div class="no-results">No guests found</div>';
      return;
    }
    
    $("#searchResults").innerHTML = guests.map((g,i) => `
      <div class="guest-result" data-index="${i}">
        <div class="result-name">${esc(g.name)}</div>
      </div>
    `).join("");
  } catch (e) {
    $("#searchResults").innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

$("#searchResults").addEventListener("click", e => {
  const el = e.target.closest(".guest-result");
  if (!el) return;
  const guest = lastResults[Number(el.dataset.index)];
  if (guest) selectGuest(guest);
});

function selectGuest(guest) {
  $("#guestName").textContent = guest.name;
  $("#guestTable").textContent = guest.table_number || "Unassigned";
  
  $("#searchResults").innerHTML = "";
  $("#guestSearch").value = "";
  $("#guestInfo").classList.remove("hidden");
  renderGuide(guest.table_number, String(guest.name || "").trim().split(/\s+/)[0]);
}

function renderGuide(tableNumber, guestFirstName) {
  const box = $("#floorplanGuide");
  if (!box) return;
  setGuideExpanded(false);
  if (!eventData || !eventData.tables.length || !tableNumber) { box.classList.add("hidden"); box.innerHTML = ""; return; }

  const doorSet = eventData.event.door_x != null && eventData.event.door_y != null;
  const matchTable = eventData.tables.find(t => String(t.table_number) === String(tableNumber));
  const matchPositioned = matchTable && matchTable.x != null && matchTable.y != null;

  // Only show the map once the host has actually placed the door and this
  // guest's table on the floor plan — mixing real positions with arbitrary
  // grid placeholders for unplaced tables would show guests a "path" that
  // doesn't reflect the real room.
  if (!doorSet || !matchPositioned) {
    box.innerHTML = `<div class="guide-label">${esc(guestFirstName || "Your")} table location will be posted here once the floor plan is finalized. Just ask a member of the wedding party for directions!</div>`;
    box.classList.remove("hidden");
    return;
  }

  // Only place tables that have a real position on the map; unplaced ones
  // would just be arbitrary clutter.
  const items = eventData.tables
    .filter(t => t.x != null && t.y != null)
    .map(t => {
      const shape = t.shape === "rectangle" ? "rectangle" : "round";
      const w = shape === "rectangle" ? RECT_W : TABLE_W;
      const h = shape === "rectangle" ? RECT_H : TABLE_H;
      return {t, shape, x: t.x, y: t.y, w, h, cx: t.x + w/2, cy: t.y + h/2};
    });

  const doorPos = {x: eventData.event.door_x, y: eventData.event.door_y};
  const stageSet = eventData.event.stage_x != null && eventData.event.stage_y != null;
  const stagePos = stageSet ? {x: eventData.event.stage_x, y: eventData.event.stage_y} : null;
  const doorCenter = {x: doorPos.x + MARKER_W/2, y: doorPos.y + MARKER_H/2};

  let minX = doorPos.x, minY = doorPos.y, maxX = doorPos.x + MARKER_W, maxY = doorPos.y + MARKER_H;
  const extend = (x,y,w,h) => { minX = Math.min(minX,x); minY = Math.min(minY,y); maxX = Math.max(maxX,x+w); maxY = Math.max(maxY,y+h); };
  if (stagePos) extend(stagePos.x, stagePos.y, MARKER_W, MARKER_H);
  items.forEach(it => extend(it.x, it.y, it.w, it.h));
  const pad = 50;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const vw = maxX - minX, vh = maxY - minY;

  const match = items.find(it => String(it.t.table_number) === String(tableNumber));

  const parts = [];
  parts.push(`<rect x="${minX}" y="${minY}" width="${vw}" height="${vh}" fill="#fffdf7" />`);
  parts.push(`<line x1="${doorCenter.x}" y1="${doorCenter.y}" x2="${match.cx}" y2="${match.cy}" class="guide-path" stroke="#c9a227" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 14" marker-end="url(#guideArrow)" />`);
  if (stagePos) {
    const stageCenter = {x: stagePos.x + MARKER_W/2, y: stagePos.y + MARKER_H/2};
    parts.push(`<rect x="${stagePos.x}" y="${stagePos.y}" width="${MARKER_W}" height="${MARKER_H}" rx="10" fill="#6b0f1a" /><text x="${stageCenter.x}" y="${stageCenter.y - 4}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="18">🎤</text><text x="${stageCenter.x}" y="${stageCenter.y + 16}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="12" font-weight="700">Stage</text>`);
  }
  items.forEach(it => {
    const isMatch = it === match;
    const fill = isMatch ? "#c9a227" : "#ffffff";
    const stroke = isMatch ? "#6b0f1a" : "#d8c8a0";
    const shapeAttrs = `fill="${fill}" stroke="${stroke}" stroke-width="${isMatch ? 4 : 2}"${isMatch ? ' class="guide-match-shape"' : ""}`;
    if (it.shape === "round") {
      parts.push(`<circle cx="${it.cx}" cy="${it.cy}" r="${it.w/2}" ${shapeAttrs} />`);
    } else {
      parts.push(`<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" rx="12" ${shapeAttrs} />`);
    }
    parts.push(`<text x="${it.cx}" y="${it.cy}" text-anchor="middle" dominant-baseline="middle" fill="${isMatch ? "#3d070d" : "#8a7a52"}" font-size="${isMatch ? 24 : 13}" font-weight="700">${esc(it.t.table_number)}</text>`);
  });
  parts.push(`<rect x="${doorPos.x}" y="${doorPos.y}" width="${MARKER_W}" height="${MARKER_H}" rx="10" fill="#2a4f2a" /><text x="${doorCenter.x}" y="${doorCenter.y - 4}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="18">🚪</text><text x="${doorCenter.x}" y="${doorCenter.y + 16}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="12" font-weight="700">Entrance</text>`);
  parts.push(`<circle cx="${doorCenter.x}" cy="${doorCenter.y}" r="6" fill="#c9a227" class="guide-pulse" />`);

  box.innerHTML = `
    <div class="guide-header">
      <div class="guide-label">${guestFirstName ? esc(guestFirstName) + ", follow" : "Follow"} the gold path from the entrance to your table</div>
      <button type="button" id="guideExpandBtn" class="guide-expand-btn" title="Expand for a bigger view">⤢ Expand</button>
    </div>
    <div class="guide-zoom-viewport" id="guideZoomViewport">
      <div class="guide-zoom-content" id="guideZoomContent">
        <svg viewBox="${minX} ${minY} ${vw} ${vh}" class="guide-svg" preserveAspectRatio="xMidYMid meet">
          <defs><marker id="guideArrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#c9a227"/></marker></defs>
          ${parts.join("")}
        </svg>
      </div>
    </div>
    <div class="guide-zoom-controls">
      <button type="button" id="guideZoomOut" aria-label="Zoom out">−</button>
      <span id="guideZoomLevel" class="guide-zoom-level">100%</span>
      <button type="button" id="guideZoomIn" aria-label="Zoom in">+</button>
      <span class="guide-zoom-hint">pinch or double-tap the map to zoom</span>
    </div>
    <div class="guide-legend">
      <span><i class="guide-swatch guide-swatch-match"></i> Your table</span>
      <span><i class="guide-swatch guide-swatch-door"></i> Entrance</span>
      ${stagePos ? '<span><i class="guide-swatch guide-swatch-stage"></i> Stage</span>' : ""}
    </div>`;
  box.classList.remove("hidden");
  $("#guideExpandBtn").onclick = () => setGuideExpanded(!box.classList.contains("expanded"));
  setupGuideZoom();
}

// --- Pinch / button zoom for the wayfinding map (guests are on phones) ---
const GUIDE_ZOOM_MIN = 1, GUIDE_ZOOM_MAX = 4, GUIDE_ZOOM_STEP = 0.5;
let guideZoom = 1;

function applyGuideZoom() {
  const content = $("#guideZoomContent");
  const level = $("#guideZoomLevel");
  if (!content) return;
  content.style.transform = `scale(${guideZoom})`;
  if (level) level.textContent = `${Math.round(guideZoom * 100)}%`;
  const outBtn = $("#guideZoomOut"), inBtn = $("#guideZoomIn");
  if (outBtn) outBtn.disabled = guideZoom <= GUIDE_ZOOM_MIN;
  if (inBtn) inBtn.disabled = guideZoom >= GUIDE_ZOOM_MAX;
}

function setGuideZoom(z) {
  guideZoom = Math.min(GUIDE_ZOOM_MAX, Math.max(GUIDE_ZOOM_MIN, z));
  applyGuideZoom();
}

function setupGuideZoom() {
  guideZoom = 1;
  applyGuideZoom();

  const viewport = $("#guideZoomViewport");
  const zoomOut = $("#guideZoomOut"), zoomIn = $("#guideZoomIn");
  if (zoomOut) zoomOut.onclick = () => setGuideZoom(guideZoom - GUIDE_ZOOM_STEP);
  if (zoomIn) zoomIn.onclick = () => setGuideZoom(guideZoom + GUIDE_ZOOM_STEP);
  if (!viewport) return;

  // Pinch-to-zoom with two touches.
  let pinchStartDist = null, pinchStartZoom = 1;
  const touchDist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  viewport.addEventListener("touchstart", e => {
    if (e.touches.length === 2) {
      pinchStartDist = touchDist(e.touches);
      pinchStartZoom = guideZoom;
    }
  }, {passive: true});

  viewport.addEventListener("touchmove", e => {
    if (e.touches.length === 2 && pinchStartDist) {
      e.preventDefault();
      const ratio = touchDist(e.touches) / pinchStartDist;
      setGuideZoom(pinchStartZoom * ratio);
    }
  }, {passive: false});

  viewport.addEventListener("touchend", e => {
    if (e.touches.length < 2) pinchStartDist = null;
  });

  // Double-tap / double-click to toggle between fit and a closer zoom.
  let lastTap = 0;
  viewport.addEventListener("touchend", e => {
    if (e.changedTouches.length !== 1 || pinchStartDist) return;
    const now = Date.now();
    if (now - lastTap < 300) setGuideZoom(guideZoom > GUIDE_ZOOM_MIN ? 1 : 2.5);
    lastTap = now;
  });
  viewport.addEventListener("dblclick", () => setGuideZoom(guideZoom > GUIDE_ZOOM_MIN ? 1 : 2.5));
}

function setGuideExpanded(expanded) {
  const box = $("#floorplanGuide");
  const backdrop = $("#guideBackdrop");
  const btn = $("#guideExpandBtn");
  box.classList.toggle("expanded", expanded);
  backdrop.classList.toggle("hidden", !expanded);
  document.body.classList.toggle("guide-lock-scroll", expanded);
  if (btn) { btn.textContent = expanded ? "⤡ Minimize" : "⤢ Expand"; btn.title = expanded ? "Minimize" : "Expand for a bigger view"; }
  setGuideZoom(1);
}

$("#guideBackdrop").addEventListener("click", () => setGuideExpanded(false));
document.addEventListener("keydown", e => { if (e.key === "Escape") setGuideExpanded(false); });

function backToSearch() {
  setGuideExpanded(false);
  $("#guestInfo").classList.add("hidden");
  $("#guestSearch").focus();
}

$("#guestSearch").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const query = e.target.value.trim();
  searchTimer = setTimeout(() => searchGuests(query), 200);
});

$("#backBtn").addEventListener("click", backToSearch);

// Load event details (name + floor plan for the wayfinding guide)
(async () => {
  try {
    eventData = await api(`/api/events/${eventId}`);
    $("#eventName").textContent = eventData.event.name;
  } catch (e) {
    $("#eventName").textContent = "Event not found";
  }
})();

$("#guestSearch").focus();
