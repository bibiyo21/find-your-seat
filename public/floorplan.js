// Floor plan: drag-and-drop table layout + guest seating + venue markers.
// Relies on globals from app.js: currentEvent, data, api(), esc(), $()

const TABLE_W = 170, TABLE_H = 170, RECT_W = 220, RECT_H = 110, GRID_GAP = 40;
const MARKER_W = 90, MARKER_H = 70;
const DEFAULT_DOOR = {x: 20, y: 20};
const DEFAULT_STAGE = {x: 20, y: 110};

function tableGuests(tableNumber){
  return data.guests.filter(g => g.table_number === tableNumber);
}

function defaultPosition(index, shape){
  const cols = 4;
  const w = shape === "rectangle" ? RECT_W : TABLE_W;
  const h = shape === "rectangle" ? RECT_H : TABLE_H;
  const col = index % cols, row = Math.floor(index / cols);
  return {x: 260 + col * (w + GRID_GAP), y: 30 + row * (h + GRID_GAP)};
}

function guestChip(g, draggable){
  return `<div class="guestChip"${draggable ? ' draggable="true"' : ""} data-guest="${g.id}">${esc(g.name)}${g.seat_number ? ` <span class="muted">#${g.seat_number}</span>` : ""}</div>`;
}

function renderFloorplan(){
  if (!data) return;

  // Unassigned guests panel
  const filter = ($("#unassignedFilter").value || "").toLowerCase();
  const unassigned = data.guests.filter(g => !g.table_number && g.name.toLowerCase().includes(filter));
  $("#unassignedGuests").innerHTML = unassigned.map(g => guestChip(g, true)).join("") || '<div class="muted">Everyone is seated.</div>';

  // Canvas + tables
  const canvas = $("#floorplanCanvas");
  const tables = data.tables.slice().sort((a,b) => String(a.table_number||"").localeCompare(String(b.table_number||""), undefined, {numeric:true}));

  let maxX = 0, maxY = 0;
  const tableHtml = tables.map((t, i) => {
    const shape = t.shape === "rectangle" ? "rectangle" : "round";
    const pos = (t.x != null && t.y != null) ? {x: t.x, y: t.y} : defaultPosition(i, shape);
    const w = shape === "rectangle" ? RECT_W : TABLE_W;
    const h = shape === "rectangle" ? RECT_H : TABLE_H;
    maxX = Math.max(maxX, pos.x + w);
    maxY = Math.max(maxY, pos.y + h);
    const guests = tableGuests(t.table_number);
    return `<div class="tableShape ${shape}" data-id="${t.id}" data-table="${esc(t.table_number)}" style="left:${pos.x}px;top:${pos.y}px;width:${w}px;height:${h}px;">
      <div class="tableShapeHead">
        <span class="tableShapeTitle">Table ${esc(t.table_number)}</span>
        <button class="shapeToggle" data-id="${t.id}" title="Toggle shape">${shape === "round" ? "▭" : "●"}</button>
      </div>
      <div class="tableShapeSeats muted">${guests.length}/${t.seats} seats</div>
      <div class="tableShapeGuests">${guests.map(g => guestChip(g, true)).join("") || '<span class="muted dropHint">Drop guests here</span>'}</div>
    </div>`;
  }).join("");

  const doorPos = (data.event.door_x != null && data.event.door_y != null) ? {x: data.event.door_x, y: data.event.door_y} : DEFAULT_DOOR;
  const stagePos = (data.event.stage_x != null && data.event.stage_y != null) ? {x: data.event.stage_x, y: data.event.stage_y} : DEFAULT_STAGE;
  maxX = Math.max(maxX, doorPos.x + MARKER_W, stagePos.x + MARKER_W);
  maxY = Math.max(maxY, doorPos.y + MARKER_H, stagePos.y + MARKER_H);

  const markerHtml = `
    <div class="venueMarker doorMarker" data-marker="door" style="left:${doorPos.x}px;top:${doorPos.y}px;width:${MARKER_W}px;height:${MARKER_H}px;">
      <span class="icon">🚪</span><span>Main Door</span>
    </div>
    <div class="venueMarker stageMarker" data-marker="stage" style="left:${stagePos.x}px;top:${stagePos.y}px;width:${MARKER_W}px;height:${MARKER_H}px;">
      <span class="icon">🎤</span><span>Stage</span>
    </div>`;

  // Fixed scroll area computed once per render (not during drag) so the canvas
  // doesn't resize/jump while dragging tables or markers around.
  const spaceW = Math.max(maxX + 700, 1400);
  const spaceH = Math.max(maxY + 500, 900);
  canvas.innerHTML = `<div id="floorplanCanvasSpace" class="floorplanCanvasSpace" style="width:${spaceW}px;height:${spaceH}px;">${markerHtml}${tableHtml || '<div class="muted" style="position:absolute;left:260px;top:30px;">Add a table to get started.</div>'}</div>`;

  wireFloorplanEvents();
}

async function assignGuestToTable(guestId, tableNumber){
  const guest = data.guests.find(g => g.id === guestId);
  if (!guest || guest.table_number === tableNumber) return;
  await api(`/api/events/${currentEvent}/guests/${guestId}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({table_number: tableNumber, seat_number: ""})
  });
  data = await api(`/api/events/${currentEvent}`);
  render();
}

async function toggleTableShape(tableId){
  const t = data.tables.find(x => x.id === tableId);
  if (!t) return;
  const shape = t.shape === "rectangle" ? "round" : "rectangle";
  await api(`/api/events/${currentEvent}/tables/${tableId}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({shape})
  });
  data = await api(`/api/events/${currentEvent}`);
  render();
}

function showSaveStatus(state){
  const el = $("#floorplanSaveStatus");
  if (!el) return;
  el.classList.remove("hidden","ok","err");
  el.classList.add(state === "ok" ? "ok" : "err");
  el.textContent = state === "ok" ? "✓ Saved" : "Could not save";
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.add("hidden"), 1800);
}

let positionSaveTimer;
function saveTablePosition(tableId, x, y){
  const rx = Math.round(x), ry = Math.round(y);
  // Update local cache immediately so switching tabs doesn't visually "reset" the layout
  // while the debounced save is in flight.
  const t = data.tables.find(tb => tb.id === tableId);
  if (t) { t.x = rx; t.y = ry; }
  clearTimeout(positionSaveTimer);
  positionSaveTimer = setTimeout(() => {
    api(`/api/events/${currentEvent}/tables/${tableId}`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({x: rx, y: ry})
    }).then(() => showSaveStatus("ok")).catch(() => showSaveStatus("err"));
  }, 250);
}

let layoutSaveTimer;
function saveMarkerPosition(marker, x, y){
  const body = marker === "door" ? {door_x: Math.round(x), door_y: Math.round(y)} : {stage_x: Math.round(x), stage_y: Math.round(y)};
  // Update local cache immediately (see note in saveTablePosition).
  data.event = {...data.event, ...body};
  clearTimeout(layoutSaveTimer);
  layoutSaveTimer = setTimeout(() => {
    api(`/api/events/${currentEvent}/layout`, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body)
    }).then(() => showSaveStatus("ok")).catch(() => showSaveStatus("err"));
  }, 250);
}

function makeDraggable(el, onDrop, ignoreSelector){
  el.addEventListener("mousedown", e => {
    if (ignoreSelector && e.target.closest(ignoreSelector)) return;
    e.preventDefault();
    const canvas = $("#floorplanCanvas");
    const maxX = canvas.scrollWidth - el.offsetWidth;
    const maxY = canvas.scrollHeight - el.offsetHeight;
    const startX = e.clientX, startY = e.clientY;
    const origLeft = el.offsetLeft, origTop = el.offsetTop;
    el.classList.add("dragging");

    function onMove(ev){
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      el.style.left = Math.min(Math.max(0, origLeft + dx), maxX) + "px";
      el.style.top = Math.min(Math.max(0, origTop + dy), maxY) + "px";
    }
    function onUp(){
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      el.classList.remove("dragging");
      onDrop(el.offsetLeft, el.offsetTop);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function wireFloorplanEvents(){
  const canvas = $("#floorplanCanvas");

  // Guest chip drag start (works for chips in unassigned panel and inside tables)
  document.querySelectorAll(".guestChip[draggable]").forEach(chip => {
    chip.ondragstart = e => {
      e.dataTransfer.setData("text/guest-id", chip.dataset.guest);
      e.dataTransfer.effectAllowed = "move";
    };
  });

  // Dropping a guest chip anywhere on the open canvas (not on a table) unassigns them.
  canvas.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  canvas.ondrop = e => {
    e.preventDefault();
    const guestId = e.dataTransfer.getData("text/guest-id");
    if (guestId) assignGuestToTable(guestId, "");
  };

  // Drop onto a table = assign guest
  document.querySelectorAll(".tableShape").forEach(shape => {
    shape.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
    shape.ondrop = e => {
      e.preventDefault();
      e.stopPropagation(); // don't let this bubble up to the canvas's "unassign" drop handler
      const guestId = e.dataTransfer.getData("text/guest-id");
      if (guestId) assignGuestToTable(guestId, shape.dataset.table);
    };
    shape.querySelector(".shapeToggle").onclick = e => {
      e.stopPropagation();
      toggleTableShape(shape.dataset.id);
    };
    makeDraggable(shape, (x,y) => saveTablePosition(shape.dataset.id, x, y), ".guestChip, .shapeToggle");
  });

  // Drop onto unassigned panel = unassign
  const unassignedPanel = $("#unassignedGuests");
  unassignedPanel.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  unassignedPanel.ondrop = e => {
    e.preventDefault();
    const guestId = e.dataTransfer.getData("text/guest-id");
    if (guestId) assignGuestToTable(guestId, "");
  };

  // Door / stage markers
  document.querySelectorAll(".venueMarker").forEach(marker => {
    makeDraggable(marker, (x,y) => saveMarkerPosition(marker.dataset.marker, x, y));
  });
}

$("#unassignedFilter").oninput = () => renderFloorplan();

$("#addTableBtn").onclick = () => {
  $("#addTableNumber").value = "";
  $("#addTableSeats").value = 8;
  $("#addTableModal").classList.remove("hidden");
  $("#addTableNumber").focus();
};
$("#addTableCancel").onclick = () => $("#addTableModal").classList.add("hidden");
$("#addTableCreate").onclick = async () => {
  try {
    const table_number = $("#addTableNumber").value.trim();
    if (!table_number) return;
    const seats = Math.max(1, Math.round(Number($("#addTableSeats").value))) || 8;
    await api(`/api/events/${currentEvent}/tables`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({table_number, seats})
    });
    $("#addTableModal").classList.add("hidden");
    data = await api(`/api/events/${currentEvent}`);
    render();
  } catch (e) {
    alert(e.message);
  }
};
