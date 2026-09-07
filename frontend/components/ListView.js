import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

export default function ListView({ eventId, data, onReload }) {
  const [guestFilter, setGuestFilter] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [lookup, setLookup] = useState("");
  const [lookupResults, setLookupResults] = useState([]);
  const [qr, setQr] = useState(null);
  const lookupTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api(`/api/events/${eventId}/qr`)
      .then((r) => !cancelled && setQr(r))
      .catch((e) => console.error("Failed to load QR code:", e));
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    clearTimeout(lookupTimer.current);
    const q = lookup.trim();
    if (!q) {
      setLookupResults([]);
      return;
    }
    lookupTimer.current = setTimeout(async () => {
      const rows = await api(`/api/events/${eventId}/search?q=${encodeURIComponent(q)}`);
      setLookupResults(rows);
    }, 200);
    return () => clearTimeout(lookupTimer.current);
  }, [lookup, eventId]);

  async function updateSeats(tableId, seats) {
    await api(`/api/events/${eventId}/tables/${tableId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seats: Number(seats) }),
    });
    onReload();
  }

  function downloadQR() {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.drawImage(img, 0, 0, 1000, 1000);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `qr-code-${eventId}.png`;
      link.click();
    };
    img.src = qr.qrCode;
  }

  const filteredGuests = data.guests.filter((g) => g.name.toLowerCase().includes(guestFilter.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredGuests.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedGuests = filteredGuests.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div id="listView">
      <div className="grid">
        <div className="panel">
          <h2>Tables</h2>
          <div id="tables">
            {data.tables.length === 0 ? (
              <div className="muted">Import an Excel sheet to create tables.</div>
            ) : (
              data.tables.map((t) => (
                <div className="tableRow" key={t.id}>
                  <span className="tableNumber">Table {t.table_number}</span>
                  <span className="grow">{data.guests.filter((g) => g.table_number === t.table_number).length} guests</span>
                  <span className="pill">{t.seats} seats</span>
                  <input
                    className="seatInput"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={t.seats}
                    title="Seat count"
                    onBlur={(e) => {
                      if (Number(e.target.value) !== t.seats) updateSeats(t.id, e.target.value);
                    }}
                  />
                </div>
              ))
            )}
          </div>
        </div>
        <div className="panel">
          <h2>Guests</h2>
          <input
            className="search"
            placeholder="Search guest..."
            value={guestFilter}
            onChange={(e) => {
              setGuestFilter(e.target.value);
              setPage(1);
            }}
          />
          <div className="pageSizeRow">
            <label htmlFor="pageSize">Show</label>
            <select
              id="pageSize"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[20, 30, 50, 80, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="muted">
              {filteredGuests.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-
              {Math.min(safePage * pageSize, filteredGuests.length)} of {filteredGuests.length}
            </span>
          </div>
          <div id="guests">
            {pagedGuests.length === 0 ? (
              <div className="muted">No guests imported.</div>
            ) : (
              pagedGuests.map((g) => (
                <div className="guestRow" key={g.id}>
                  <span className="name">{g.name}</span>
                  <span className="pill">Table {g.table_number || "Unassigned"}</span>
                  {g.seat_number ? <span className="pill">Seat {g.seat_number}</span> : null}
                </div>
              ))
            )}
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button type="button" onClick={() => setPage(1)} disabled={safePage === 1}>
                &laquo;
              </button>
              <button type="button" onClick={() => setPage(safePage - 1)} disabled={safePage === 1}>
                &lsaquo;
              </button>
              <span className="pageInfo">
                Page {safePage} of {totalPages}
              </span>
              <button type="button" onClick={() => setPage(safePage + 1)} disabled={safePage === totalPages}>
                &rsaquo;
              </button>
              <button type="button" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>
                &raquo;
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="grid">
        <div className="panel qrPanel">
          <h2>Event Check-In</h2>
          <p>Share this QR code with guests for check-in:</p>
          <div id="qrCode" style={{ textAlign: "center" }}>
            {qr && (
              <>
                <img src={qr.qrCode} alt="Check-in QR Code" style={{ maxWidth: 200, borderRadius: 8 }} />
                <p style={{ textAlign: "center", fontSize: 12, color: "#777", marginTop: 8 }}>
                  <a href={qr.url} target="_blank" rel="noreferrer" style={{ color: "#292723", textDecoration: "none" }}>
                    Check-in Link
                  </a>
                </p>
                <p style={{ textAlign: "center", marginTop: 12 }}>
                  <button
                    onClick={downloadQR}
                    style={{
                      padding: "8px 16px",
                      background: "#292723",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    &darr; Download QR Code
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
        <div className="panel guestLookup">
          <h2>Guest Seat Lookup</h2>
          <p>Public-style lookup for testing your guest experience.</p>
          <input
            className="search"
            placeholder="Type a guest name..."
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
          />
          <div id="lookupResults">
            {lookup.trim() && lookupResults.length === 0 ? (
              <div className="muted">No matching guest.</div>
            ) : (
              lookupResults.map((g) => (
                <div className="result" key={g.id}>
                  <strong>{g.name}</strong>
                  <br />
                  Table <strong>{g.table_number || "Not assigned"}</strong>
                  {g.seat_number ? ` · Seat ${g.seat_number}` : ""}
                  <br />
                  <span className="muted">{g.seats || 0} seats at this table</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
