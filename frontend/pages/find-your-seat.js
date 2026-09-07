import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { api } from "../lib/api";

export default function FindYourSeat() {
  const router = useRouter();
  const [allEvents, setAllEvents] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    (async () => {
      try {
        const events = await api("/api/events/list");
        setAllEvents(events);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? allEvents.filter((e) => e.name.toLowerCase().includes(q)) : allEvents;
  }, [allEvents, query]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  function goToEvent(id) {
    router.push(`/events/${id}`);
  }

  function onSearchKeyDown(e) {
    if (!filtered.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      goToEvent(filtered[activeIndex].id);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  }

  return (
    <>
      <Head>
        <title>Find Your Seat - Select Event</title>
      </Head>
      <div className="container">
        <div className="header">
          <h1>
            <span className="heart">&hearts;</span> Find Your Seat
          </h1>
          <p className="event-name">Select Your Event</p>
        </div>
        <div className="content">
          <div className="search-section">
            <h2>Available Events</h2>
            <div className="search-input-wrap">
              <input
                className="search-input"
                type="text"
                placeholder="Search events..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                role="combobox"
                aria-expanded={filtered.length > 0}
                aria-controls="eventsList"
                aria-autocomplete="list"
              />
              {!loaded && <span className="search-spinner" aria-hidden="true" />}
            </div>
            <div id="eventsList" className="results" role="listbox">
              {error ? (
                <div className="error">{error}</div>
              ) : loaded && filtered.length === 0 ? (
                <div className="no-results">
                  {allEvents.length === 0 ? "No events available. Please create an event first." : "No events found"}
                </div>
              ) : (
                filtered.map((e, i) => (
                  <div
                    className={`guest-result${i === activeIndex ? " active" : ""}`}
                    key={e.id}
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => goToEvent(e.id)}
                    onMouseEnter={() => setActiveIndex(i)}
                    role="option"
                    aria-selected={i === activeIndex}
                  >
                    <div className="result-name">{e.name}</div>
                    <div className="result-details">Click to check in</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
