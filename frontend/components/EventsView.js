import { api } from "../lib/api";

export default function EventsView({ events, onOpen, onDeleted }) {
  async function deleteEvent(e, id, evName) {
    e.stopPropagation();
    if (!confirm(`Delete "${evName}"? This will permanently remove all tables and guests for this event.`)) return;
    try {
      await api(`/api/events/${id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <section id="eventsView">
      <h1>Your Events</h1>
      <div id="events" className="cards">
        {events.map((e) => (
          <div className="card" style={{ cursor: "pointer" }} key={e.id} onClick={() => onOpen(e.id)}>
            <h3>{e.name}</h3>
            <div className="muted">
              {e.table_count} tables · {e.guest_count} guests · {e.seat_count} seats
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <a
                href={`/events/${e.id}`}
                target="_blank"
                rel="noreferrer"
                onClick={(ev) => ev.stopPropagation()}
                style={{
                  display: "inline-block",
                  padding: "8px 12px",
                  background: "#292723",
                  color: "#fff",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Find Your Seat &rarr;
              </a>
              <button
                onClick={(ev) => deleteEvent(ev, e.id, e.name)}
                style={{
                  padding: "8px 12px",
                  background: "#fff",
                  color: "#b02a2a",
                  border: "1px solid #d8a3a3",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {events.length === 0 && <div className="empty">Create your first wedding event.</div>}
    </section>
  );
}
