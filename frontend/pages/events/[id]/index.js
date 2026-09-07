import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { api } from "../../../lib/api";
import WayfindingGuide from "../../../components/WayfindingGuide";

export default function CheckIn() {
  const router = useRouter();
  const { id: eventId } = router.query;

  const [eventData, setEventData] = useState(null);
  const [eventName, setEventName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchTimer = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const data = await api(`/api/events/${eventId}`);
        setEventData(data);
        setEventName(data.event.name);
      } catch (e) {
        setEventName("Event not found");
      }
    })();
  }, [eventId]);

  useEffect(() => {
    searchInputRef.current && searchInputRef.current.focus();
  }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!eventId) return;
    const q = query.trim();
    setActiveIndex(-1);
    if (!q) {
      setResults([]);
      setSearchError("");
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const guests = await api(`/api/events/${eventId}/guest?q=${encodeURIComponent(q)}`);
        setResults(guests);
        setSearchError("");
      } catch (e) {
        setSearchError(e.message);
      } finally {
        setIsSearching(false);
      }
    }, 200);
    return () => clearTimeout(searchTimer.current);
  }, [query, eventId]);

  function selectGuest(guest) {
    setSelectedGuest(guest);
    setResults([]);
    setQuery("");
  }

  function backToSearch() {
    setSelectedGuest(null);
    searchInputRef.current && searchInputRef.current.focus();
  }

  function onSearchKeyDown(e) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectGuest(results[activeIndex]);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  }

  const guestFirstName = selectedGuest ? String(selectedGuest.name || "").trim().split(/\s+/)[0] : "";

  return (
    <>
      <Head>
        <title>Find Your Seat</title>
      </Head>
      <div className="container">
        <div className="header">
          <h1>
            <span className="heart">&hearts;</span> Find Your Seat <span className="heart">&hearts;</span>
          </h1>
          <p id="eventName" className="event-name">
            {eventName}
          </p>
        </div>

        <div className="content">
          {!selectedGuest && (
            <div className="search-section">
              <h2>Find Your Name</h2>
              <div className="search-input-wrap">
                <input
                  id="guestSearch"
                  ref={searchInputRef}
                  className="search-input"
                  type="text"
                  placeholder="Type your name..."
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  role="combobox"
                  aria-expanded={results.length > 0}
                  aria-controls="searchResults"
                  aria-autocomplete="list"
                />
                {isSearching && <span className="search-spinner" aria-hidden="true" />}
              </div>
              <div id="searchResults" className="results" role="listbox">
                {searchError ? (
                  <div className="error">{searchError}</div>
                ) : query.trim() && !isSearching && results.length === 0 ? (
                  <div className="no-results">No guests found</div>
                ) : (
                  results.map((g, i) => (
                    <div
                      className={`guest-result${i === activeIndex ? " active" : ""}`}
                      key={g.id}
                      style={{ animationDelay: `${i * 40}ms` }}
                      onClick={() => selectGuest(g)}
                      onMouseEnter={() => setActiveIndex(i)}
                      role="option"
                      aria-selected={i === activeIndex}
                    >
                      <div className="result-name">{g.name}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {selectedGuest && (
            <div id="guestInfo" className="guest-info">
              <div className="guest-card">
                <div className="guest-name-display" id="guestName">
                  {selectedGuest.name}
                </div>
                <div className="table-label">Table</div>
                <div className="table-number-display" id="guestTable">
                  {selectedGuest.table_number || "Unassigned"}
                </div>
                <WayfindingGuide eventData={eventData} tableNumber={selectedGuest.table_number} guestFirstName={guestFirstName} />
                <button id="backBtn" className="back-btn" onClick={backToSearch}>
                  Back to Search
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
