import { api } from "../lib/api";
import ListView from "./ListView";
import FloorplanView from "./FloorplanView";

export default function EventDetail({ eventId, data, onReload, onBack, onDeleted, tab, setTab }) {
  async function onImportExcel(e) {
    const f = e.target.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    try {
      const r = await api(`/api/events/${eventId}/import`, { method: "POST", body: fd });
      alert(`Imported ${r.imported} guests across ${r.tables} tables. Seat capacity derived from guest rows.`);
      onReload();
    } catch (err) {
      alert(err.message);
    }
    e.target.value = "";
  }

  async function deleteEvent() {
    if (!confirm(`Delete "${data.event.name}"? This will permanently remove all tables and guests for this event.`)) return;
    try {
      await api(`/api/events/${eventId}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      alert(e.message);
    }
  }

  const assigned = data.guests.filter((g) => g.table_number).length;
  const seats = data.tables.reduce((a, t) => a + t.seats, 0);

  return (
    <section id="eventView">
      <div className="toolbar">
        <button id="back" onClick={onBack}>
          &larr; Events
        </button>
        <div>
          <h1 id="eventName">{data.event.name}</h1>
          <div id="stats">
            {data.tables.length} tables · {data.guests.length} guests · {assigned} assigned · {seats} seats
          </div>
        </div>
        <label className="button">
          Import Excel
          <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={onImportExcel} />
        </label>
        <a className="button" href={`/api/events/${eventId}/export/excel`} download>
          Export Excel
        </a>
        <a className="button" href={`/events/${eventId}/print`} target="_blank" rel="noreferrer">
          Print Chart
        </a>
        <button onClick={deleteEvent} style={{ color: "#b02a2a", borderColor: "#d8a3a3" }}>
          Delete Event
        </button>
      </div>
      <div className="tabs">
        <button className={`tabBtn ${tab === "list" ? "active" : ""}`} onClick={() => setTab("list")}>
          List View
        </button>
        <button className={`tabBtn ${tab === "floorplan" ? "active" : ""}`} onClick={() => setTab("floorplan")}>
          Floor Plan
        </button>
      </div>
      {tab === "list" ? (
        <ListView eventId={eventId} data={data} onReload={onReload} />
      ) : (
        <FloorplanView eventId={eventId} data={data} onReload={onReload} />
      )}
    </section>
  );
}
