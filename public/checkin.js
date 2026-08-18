const $ = s => document.querySelector(s);
const eventId = window.location.pathname.split('/')[2];
let searchTimer;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

async function api(url, opt = {}) {
  const r = await fetch(url, opt);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}

async function searchGuests(query) {
  if (!query.trim()) {
    $("#searchResults").innerHTML = "";
    return;
  }
  
  try {
    const guests = await api(`/api/events/${eventId}/guest?q=${encodeURIComponent(query)}`);
    
    if (guests.length === 0) {
      $("#searchResults").innerHTML = '<div class="no-results">No guests found</div>';
      return;
    }
    
    $("#searchResults").innerHTML = guests.map(g => `
      <div class="guest-result" onclick="selectGuest('${esc(g.name)}', '${esc(g.table_number || 'Unassigned')}')">
        <div class="result-name">${esc(g.name)}</div>
        <div class="result-details">
          Table ${esc(g.table_number || "Unassigned")}
        </div>
      </div>
    `).join("");
  } catch (e) {
    $("#searchResults").innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

function selectGuest(name, table) {
  $("#guestName").textContent = name;
  $("#guestTable").textContent = table;
  
  $("#searchResults").innerHTML = "";
  $("#guestSearch").value = "";
  $("#guestInfo").classList.remove("hidden");
}

function backToSearch() {
  $("#guestInfo").classList.add("hidden");
  $("#guestSearch").focus();
}

$("#guestSearch").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const query = e.target.value.trim();
  searchTimer = setTimeout(() => searchGuests(query), 200);
});

$("#backBtn").addEventListener("click", backToSearch);

// Load event name
(async () => {
  try {
    const event = await api(`/api/events/${eventId}`);
    $("#eventName").textContent = event.event.name;
  } catch (e) {
    $("#eventName").textContent = "Event not found";
  }
})();

$("#guestSearch").focus();
