import { useEffect, useState } from "react";
import Head from "next/head";
import { getSession } from "../../../lib/session";

export async function getServerSideProps({ req, params }) {
  const session = await getSession(req);
  if (!session.authenticated) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  return { props: { eventId: params.id } };
}

export default function Print({ eventId }) {
  const [eventName, setEventName] = useState("");
  const [error, setError] = useState("");
  const [byTable, setByTable] = useState([]);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/events/${eventId}`);
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Could not load event.");
        return;
      }
      setEventName(data.event.name);

      const map = new Map();
      data.tables
        .slice()
        .sort((a, b) => String(a.table_number || "").localeCompare(String(b.table_number || ""), undefined, { numeric: true }))
        .forEach((t) => map.set(t.table_number, { table: t, guests: [] }));
      data.guests.forEach((g) => {
        const key = g.table_number || "Unassigned";
        if (!map.has(key)) map.set(key, { table: { table_number: key, seats: 0 }, guests: [] });
        map.get(key).guests.push(g);
      });
      setByTable([...map.values()]);
    })();
  }, [eventId]);

  return (
    <>
      <Head>
        <title>Seating Chart</title>
      </Head>
      <div className="toolbar no-print">
        <button onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <div className="sheet">
        <h1 id="eventName">{eventName}</h1>
        <div id="chart">
          {error ? (
            <p className="muted">{error}</p>
          ) : (
            byTable.map(({ table, guests }) => (
              <div className="tableBlock" key={table.table_number}>
                <h2>
                  Table {table.table_number}{" "}
                  <span className="muted" style={{ fontSize: 14, fontWeight: "normal" }}>
                    ({table.seats} seats · {guests.length} guests)
                  </span>
                </h2>
                <ul>
                  {guests.length === 0 ? (
                    <li className="muted">No guests assigned.</li>
                  ) : (
                    guests
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((g) => (
                        <li key={g.id}>
                          {g.name}
                          {g.seat_number ? ` — Seat ${g.seat_number}` : ""}
                        </li>
                      ))
                  )}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
