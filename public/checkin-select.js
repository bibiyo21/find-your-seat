const $ = s => document.querySelector(s);
let allEvents = [];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

async function api(url, opt = {}) {
  const r = await fetch(url, opt);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}

function displayEvents(events) {
  if (events.length === 0) {
    $("#eventsList").innerHTML = '<div class="no-results">No events found</div>';
    return;
  }
  
  $("#eventsList").innerHTML = events.map(e => `
    <div class="guest-result" onclick="selectEvent(${e.id}, '${esc(e.name)}')">
      <div class="result-name">${esc(e.name)}</div>
      <div class="result-details">Click to check in</div>
    </div>
  `).join("");
}

function selectEvent(eventId, eventName) {
  window.location.href = `/find-your-seat/${eventId}`;
}

function filterEvents() {
  const query = $("#eventSearch").value.toLowerCase();
  if (!query) {
    displayEvents(allEvents);
    return;
  }
  
  const filtered = allEvents.filter(e => 
    e.name.toLowerCase().includes(query)
  );
  displayEvents(filtered);
}

// Load events on page load
(async () => {
  try {
    allEvents = await api("/api/find-your-seat/events/list");
    displayEvents(allEvents);
    
    if (allEvents.length === 0) {
      $("#eventsList").innerHTML = '<div class="no-results">No events available. Please create an event first.</div>';
    }
  } catch (e) {
    $("#eventsList").innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
})();

$("#eventSearch").addEventListener("input", filterEvents);
