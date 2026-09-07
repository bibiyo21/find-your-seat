import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { getSession } from "../lib/session";
import { api } from "../lib/api";
import EventsView from "../components/EventsView";
import EventDetail from "../components/EventDetail";

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (!session.authenticated) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  return { props: {} };
}

export default function Dashboard() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [currentEventId, setCurrentEventId] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [tab, setTab] = useState("list");
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventName, setNewEventName] = useState("");

  async function loadEvents() {
    const data = await api("/api/events");
    setEvents(data);
  }

  useEffect(() => {
    loadEvents();
  }, []);

  async function openEvent(id) {
    setCurrentEventId(id);
    setTab("list");
    const data = await api(`/api/events/${id}`);
    setEventData(data);
  }

  async function reloadEvent() {
    if (!currentEventId) return;
    const data = await api(`/api/events/${currentEventId}`);
    setEventData(data);
  }

  function backToEvents() {
    setCurrentEventId(null);
    setEventData(null);
    loadEvents();
  }

  async function createEvent() {
    try {
      const trimmed = newEventName.trim();
      if (!trimmed) return;
      const e = await api("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      setShowNewEvent(false);
      setNewEventName("");
      await openEvent(e.id);
    } catch (err) {
      alert(err.message);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      <Head>
        <title>Wedding Seating Planner</title>
      </Head>
      <header>
        <div className="brand">&hearts; Wedding Seating Planner</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            id="newEvent"
            onClick={() => {
              setNewEventName("");
              setShowNewEvent(true);
            }}
          >
            + New Event
          </button>
          <button id="logoutBtn" onClick={logout}>
            Log Out
          </button>
        </div>
      </header>
      <main className={currentEventId && tab === "floorplan" ? "wide" : ""}>
        {!currentEventId || !eventData ? (
          <EventsView events={events} onOpen={openEvent} onDeleted={loadEvents} />
        ) : (
          <EventDetail
            eventId={currentEventId}
            data={eventData}
            onReload={reloadEvent}
            onBack={backToEvents}
            onDeleted={backToEvents}
            tab={tab}
            setTab={setTab}
          />
        )}
      </main>

      <div className={`modal ${showNewEvent ? "" : "hidden"}`}>
        <div className="modalBox">
          <h2>Create New Event</h2>
          <input
            className="search"
            placeholder="e.g. Ibrahem & Partner Wedding"
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
            autoFocus
          />
          <div className="actions">
            <button onClick={() => setShowNewEvent(false)}>Cancel</button>
            <button className="primary" onClick={createEvent}>
              Create Event
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
