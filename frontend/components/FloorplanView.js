import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

const TABLE_W = 170, TABLE_H = 170, RECT_W = 220, RECT_H = 110, GRID_GAP = 40;
const MARKER_W = 90, MARKER_H = 70;
const DEFAULT_DOOR = { x: 20, y: 20 };
const DEFAULT_STAGE = { x: 20, y: 110 };

function defaultPosition(index, shape) {
  const cols = 4;
  const w = shape === "rectangle" ? RECT_W : TABLE_W;
  const h = shape === "rectangle" ? RECT_H : TABLE_H;
  const col = index % cols, row = Math.floor(index / cols);
  return { x: 260 + col * (w + GRID_GAP), y: 30 + row * (h + GRID_GAP) };
}

function GuestChip({ guest, draggable, onDragStart }) {
  return (
    <div className="guestChip" draggable={draggable} data-guest={guest.id} onDragStart={onDragStart}>
      {guest.name}
      {guest.seat_number ? <span className="muted"> #{guest.seat_number}</span> : null}
    </div>
  );
}

// Native-mousedown dragging, ported from public/floorplan.js's makeDraggable().
// Manipulates the DOM node directly while dragging (for smoothness) and only
// commits the final position to React/the API on mouseup.
function useDraggable(ref, canvasRef, onDrop, ignoreSelector) {
  useEffect(() => {
    const el = ref.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    function onMouseDown(e) {
      if (ignoreSelector && e.target.closest(ignoreSelector)) return;
      e.preventDefault();
      const maxX = canvas.scrollWidth - el.offsetWidth;
      const maxY = canvas.scrollHeight - el.offsetHeight;
      const startX = e.clientX, startY = e.clientY;
      const origLeft = el.offsetLeft, origTop = el.offsetTop;
      el.classList.add("dragging");

      function onMove(ev) {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        el.style.left = Math.min(Math.max(0, origLeft + dx), maxX) + "px";
        el.style.top = Math.min(Math.max(0, origTop + dy), maxY) + "px";
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        el.classList.remove("dragging");
        onDrop(el.offsetLeft, el.offsetTop);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }

    el.addEventListener("mousedown", onMouseDown);
    return () => el.removeEventListener("mousedown", onMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });
}

function TableShape({ table, guests, canvasRef, onDrop, onDropGuest, onToggleShape }) {
  const ref = useRef(null);
  useDraggable(ref, canvasRef, (x, y) => onDrop(table.id, x, y), ".guestChip, .shapeToggle");
  const shape = table.shape === "rectangle" ? "rectangle" : "round";
  const w = shape === "rectangle" ? RECT_W : TABLE_W;
  const h = shape === "rectangle" ? RECT_H : TABLE_H;

  return (
    <div
      ref={ref}
      className={`tableShape ${shape}`}
      data-id={table.id}
      style={{ left: table._pos.x, top: table._pos.y, width: w, height: h }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const guestId = e.dataTransfer.getData("text/guest-id");
        if (guestId) onDropGuest(guestId, table.table_number);
      }}
    >
      <div className="tableShapeHead">
        <span className="tableShapeTitle">Table {table.table_number}</span>
        <button
          className="shapeToggle"
          title="Toggle shape"
          onClick={(e) => {
            e.stopPropagation();
            onToggleShape(table.id);
          }}
        >
          {shape === "round" ? "▭" : "●"}
        </button>
      </div>
      <div className="tableShapeSeats muted">
        {guests.length}/{table.seats} seats
      </div>
      <div className="tableShapeGuests">
        {guests.length === 0 ? (
          <span className="muted dropHint">Drop guests here</span>
        ) : (
          guests.map((g) => (
            <GuestChip
              key={g.id}
              guest={g}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/guest-id", g.id);
                e.dataTransfer.effectAllowed = "move";
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function VenueMarker({ marker, pos, canvasRef, onDrop, icon, label, className }) {
  const ref = useRef(null);
  useDraggable(ref, canvasRef, (x, y) => onDrop(marker, x, y));
  return (
    <div ref={ref} className={`venueMarker ${className}`} data-marker={marker} style={{ left: pos.x, top: pos.y, width: MARKER_W, height: MARKER_H }}>
      <span className="icon">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export default function FloorplanView({ eventId, data, onReload }) {
  const [unassignedFilter, setUnassignedFilter] = useState("");
  const [saveStatus, setSaveStatus] = useState(null); // "ok" | "err" | null
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableSeats, setNewTableSeats] = useState(8);
  const canvasRef = useRef(null);
  const positionSaveTimer = useRef(null);
  const layoutSaveTimer = useRef(null);
  const statusHideTimer = useRef(null);

  function tableGuests(tableNumber) {
    return data.guests.filter((g) => g.table_number === tableNumber);
  }

  function flashStatus(state) {
    setSaveStatus(state);
    clearTimeout(statusHideTimer.current);
    statusHideTimer.current = setTimeout(() => setSaveStatus(null), 1800);
  }

  async function assignGuestToTable(guestId, tableNumber) {
    const guest = data.guests.find((g) => g.id === guestId);
    if (!guest || guest.table_number === tableNumber) return;
    await api(`/api/events/${eventId}/guests/${guestId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table_number: tableNumber, seat_number: "" }),
    });
    onReload();
  }

  async function toggleTableShape(tableId) {
    const t = data.tables.find((x) => x.id === tableId);
    if (!t) return;
    const shape = t.shape === "rectangle" ? "round" : "rectangle";
    await api(`/api/events/${eventId}/tables/${tableId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shape }),
    });
    onReload();
  }

  function saveTablePosition(tableId, x, y) {
    const rx = Math.round(x), ry = Math.round(y);
    clearTimeout(positionSaveTimer.current);
    positionSaveTimer.current = setTimeout(() => {
      api(`/api/events/${eventId}/tables/${tableId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: rx, y: ry }),
      })
        .then(() => flashStatus("ok"))
        .catch(() => flashStatus("err"));
    }, 250);
  }

  function saveMarkerPosition(marker, x, y) {
    const body = marker === "door" ? { door_x: Math.round(x), door_y: Math.round(y) } : { stage_x: Math.round(x), stage_y: Math.round(y) };
    clearTimeout(layoutSaveTimer.current);
    layoutSaveTimer.current = setTimeout(() => {
      api(`/api/events/${eventId}/layout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(() => flashStatus("ok"))
        .catch(() => flashStatus("err"));
    }, 250);
  }

  async function addTable() {
    try {
      const table_number = newTableNumber.trim();
      if (!table_number) return;
      const seats = Math.max(1, Math.round(Number(newTableSeats))) || 8;
      await api(`/api/events/${eventId}/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table_number, seats }),
      });
      setShowAddTable(false);
      onReload();
    } catch (e) {
      alert(e.message);
    }
  }

  const unassigned = data.guests.filter((g) => !g.table_number && g.name.toLowerCase().includes(unassignedFilter.toLowerCase()));
  const tables = data.tables
    .slice()
    .sort((a, b) => String(a.table_number || "").localeCompare(String(b.table_number || ""), undefined, { numeric: true }));

  let maxX = 0, maxY = 0;
  const positionedTables = tables.map((t, i) => {
    const shape = t.shape === "rectangle" ? "rectangle" : "round";
    const pos = t.x != null && t.y != null ? { x: t.x, y: t.y } : defaultPosition(i, shape);
    const w = shape === "rectangle" ? RECT_W : TABLE_W;
    const h = shape === "rectangle" ? RECT_H : TABLE_H;
    maxX = Math.max(maxX, pos.x + w);
    maxY = Math.max(maxY, pos.y + h);
    return { ...t, _pos: pos };
  });

  const doorPos = data.event.door_x != null && data.event.door_y != null ? { x: data.event.door_x, y: data.event.door_y } : DEFAULT_DOOR;
  const stagePos = data.event.stage_x != null && data.event.stage_y != null ? { x: data.event.stage_x, y: data.event.stage_y } : DEFAULT_STAGE;
  maxX = Math.max(maxX, doorPos.x + MARKER_W, stagePos.x + MARKER_W);
  maxY = Math.max(maxY, doorPos.y + MARKER_H, stagePos.y + MARKER_H);
  const spaceW = Math.max(maxX + 700, 1400);
  const spaceH = Math.max(maxY + 500, 900);

  return (
    <div id="floorplanView">
      <div className="floorplanWrap">
        <div className="panel unassignedPanel">
          <h2>Unassigned Guests</h2>
          <input
            className="search"
            placeholder="Search guest..."
            value={unassignedFilter}
            onChange={(e) => setUnassignedFilter(e.target.value)}
          />
          <div
            id="unassignedGuests"
            className="chipList"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const guestId = e.dataTransfer.getData("text/guest-id");
              if (guestId) assignGuestToTable(guestId, "");
            }}
          >
            {unassigned.length === 0 ? (
              <div className="muted">Everyone is seated.</div>
            ) : (
              unassigned.map((g) => (
                <GuestChip
                  key={g.id}
                  guest={g}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/guest-id", g.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                />
              ))
            )}
          </div>
        </div>
        <div className="panel floorplanCanvasPanel">
          <div className="floorplanToolbar">
            <h2>Floor Plan</h2>
            <span className="muted">Drag tables/door/stage to arrange · drag guests to seat them</span>
            {saveStatus && <span className={`saveStatus ${saveStatus}`}>{saveStatus === "ok" ? "✓ Saved" : "Could not save"}</span>}
            <button className="primary" onClick={() => { setNewTableNumber(""); setNewTableSeats(8); setShowAddTable(true); }}>
              + Add Table
            </button>
          </div>
          <div
            id="floorplanCanvas"
            className="floorplanCanvas"
            ref={canvasRef}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const guestId = e.dataTransfer.getData("text/guest-id");
              if (guestId) assignGuestToTable(guestId, "");
            }}
          >
            <div id="floorplanCanvasSpace" className="floorplanCanvasSpace" style={{ width: spaceW, height: spaceH }}>
              <VenueMarker marker="door" pos={doorPos} canvasRef={canvasRef} onDrop={saveMarkerPosition} icon="🚪" label="Main Door" className="doorMarker" />
              <VenueMarker marker="stage" pos={stagePos} canvasRef={canvasRef} onDrop={saveMarkerPosition} icon="🎤" label="Stage" className="stageMarker" />
              {positionedTables.length === 0 ? (
                <div className="muted" style={{ position: "absolute", left: 260, top: 30 }}>
                  Add a table to get started.
                </div>
              ) : (
                positionedTables.map((t) => (
                  <TableShape
                    key={t.id}
                    table={t}
                    guests={tableGuests(t.table_number)}
                    canvasRef={canvasRef}
                    onDrop={saveTablePosition}
                    onDropGuest={assignGuestToTable}
                    onToggleShape={toggleTableShape}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`modal ${showAddTable ? "" : "hidden"}`}>
        <div className="modalBox">
          <h2>Add Table</h2>
          <input
            className="search"
            placeholder="Table number/name, e.g. 12"
            value={newTableNumber}
            onChange={(e) => setNewTableNumber(e.target.value)}
            autoFocus
          />
          <label className="muted" style={{ display: "block", marginBottom: 6 }}>
            Seats
          </label>
          <input
            className="search"
            type="number"
            min="1"
            step="1"
            value={newTableSeats}
            onChange={(e) => setNewTableSeats(e.target.value)}
          />
          <div className="actions">
            <button onClick={() => setShowAddTable(false)}>Cancel</button>
            <button className="primary" onClick={addTable}>
              Add Table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
