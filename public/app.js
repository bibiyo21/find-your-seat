let currentEvent=null,data=null;
const $=s=>document.querySelector(s);
async function api(url,opt={}){const r=await fetch(url,opt);const j=await r.json();if(!r.ok)throw new Error(j.error||"Request failed");return j}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function loadQRCode(){try{const qr=await api(`/api/events/${currentEvent}/qr`);const qrBox=$("#qrCode");if(qrBox){const downloadQR=()=>{const canvas=document.createElement("canvas");canvas.width=1000;canvas.height=1000;const ctx=canvas.getContext("2d");const img=new Image();img.onload=()=>{ctx.fillStyle="#fff";ctx.fillRect(0,0,1000,1000);ctx.drawImage(img,0,0,1000,1000);const link=document.createElement("a");link.href=canvas.toDataURL("image/png");link.download=`qr-code-${currentEvent}.png`;link.click()};img.src=qr.qrCode};qrBox.innerHTML=`<img src="${qr.qrCode}" alt="Check-in QR Code" style="max-width:200px;border-radius:8px;"><p style="text-align:center;font-size:12px;color:#777;margin-top:8px;"><a href="${qr.url}" target="_blank" style="color:#292723;text-decoration:none;">Check-in Link</a></p><p style="text-align:center;margin-top:12px;"><button id="downloadQR" style="padding:8px 16px;background:#292723;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;">⬇ Download QR Code</button></p>`;document.getElementById("downloadQR").onclick=downloadQR}}catch(e){console.error("Failed to load QR code:",e)}}
async function deleteEvent(id,name){
 if(!confirm(`Delete "${name}"? This will permanently remove all tables and guests for this event.`))return false;
 try{await api(`/api/events/${id}`,{method:"DELETE"});await loadEvents();return true}catch(e){alert(e.message);return false}
}
async function loadEvents(){
 const events=await api("/api/events"); const box=$("#events"); box.innerHTML="";
 $("#emptyEvents").classList.toggle("hidden",events.length>0);
 events.forEach(e=>{const d=document.createElement("div");d.className="card";d.style.cursor="pointer";d.innerHTML=`<h3>${esc(e.name)}</h3><div class="muted">${e.table_count} tables · ${e.guest_count} guests · ${e.seat_count} seats</div><div style="margin-top:12px;display:flex;gap:8px;"><a href="/events/${e.id}" target="_blank" style="display:inline-block;padding:8px 12px;background:#292723;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">Find Your Seat →</a><button class="deleteEvent" data-id="${e.id}" data-name="${esc(e.name)}" style="padding:8px 12px;background:#fff;color:#b02a2a;border:1px solid #d8a3a3;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;">Delete</button></div>`;d.onclick=()=>openEvent(e.id);box.appendChild(d)})
 document.querySelectorAll(".deleteEvent").forEach(btn=>btn.onclick=(ev)=>{ev.stopPropagation();deleteEvent(btn.dataset.id,btn.dataset.name)})
}
async function openEvent(id){currentEvent=id;data=await api(`/api/events/${id}`);$("#eventsView").classList.add("hidden");$("#eventView").classList.remove("hidden");$("#exportExcel").href=`/api/events/${id}/export/excel`;$("#printChart").href=`/events/${id}/print`;showTab("list");render();loadQRCode()}
function showTab(tab){
  $("#tabList").classList.toggle("active",tab==="list");
  $("#tabFloorplan").classList.toggle("active",tab==="floorplan");
  $("#listView").classList.toggle("hidden",tab!=="list");
  $("#floorplanView").classList.toggle("hidden",tab!=="floorplan");
  document.querySelector("main").classList.toggle("wide",tab==="floorplan");
  if(tab==="floorplan")renderFloorplan();
}
$("#tabList").onclick=()=>showTab("list");
$("#tabFloorplan").onclick=()=>showTab("floorplan");
function render(){
 $("#eventName").textContent=data.event.name;
 const assigned=data.guests.filter(g=>g.table_number).length;
 const seats=data.tables.reduce((a,t)=>a+t.seats,0);
 $("#stats").textContent=`${data.tables.length} tables · ${data.guests.length} guests · ${assigned} assigned · ${seats} seats`;
 $("#tables").innerHTML=data.tables.map(t=>`<div class="tableRow"><span class="tableNumber">Table ${esc(t.table_number)}</span><span class="grow">${data.guests.filter(g=>g.table_number===t.table_number).length} guests</span><span class="pill">${t.seats} seats</span><input class="seatInput" type="number" min="0" step="1" value="${t.seats}" data-table="${t.id}" title="Seat count"></div>`).join("")||'<div class="muted">Import an Excel sheet to create tables.</div>';
 $("#guests").innerHTML=guestRows(data.guests);
 refreshFloorplanIfVisible();
 document.querySelectorAll("[data-table]").forEach(i=>i.onchange=async()=>{await api(`/api/events/${currentEvent}/tables/${i.dataset.table}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({seats:Number(i.value)})});data=await api(`/api/events/${currentEvent}`);render()})
}
function refreshFloorplanIfVisible(){if(!$("#floorplanView").classList.contains("hidden"))renderFloorplan()}
function guestRows(gs){return gs.map(g=>`<div class="guestRow"><span class="name">${esc(g.name)}</span><span class="pill">Table ${esc(g.table_number||"Unassigned")}</span>${g.seat_number?`<span class="pill">Seat ${g.seat_number}</span>`:""}</div>`).join("")||'<div class="muted">No guests imported.</div>'}
$("#newEvent").onclick=()=>{$("#modal").classList.remove("hidden");$("#eventInput").focus()};
$("#cancel").onclick=()=>$("#modal").classList.add("hidden");
$("#create").onclick=async()=>{try{const name=$("#eventInput").value.trim();if(!name)return;const e=await api("/api/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});$("#modal").classList.add("hidden");$("#eventInput").value="";await openEvent(e.id)}catch(e){alert(e.message)}};
$("#back").onclick=()=>{$("#eventView").classList.add("hidden");$("#eventsView").classList.remove("hidden");document.querySelector("main").classList.remove("wide");loadEvents()};
$("#deleteEventBtn").onclick=async()=>{const ok=await deleteEvent(currentEvent,data.event.name);if(ok){$("#eventView").classList.add("hidden");$("#eventsView").classList.remove("hidden");document.querySelector("main").classList.remove("wide")}};
$("#excel").onchange=async e=>{const f=e.target.files[0];if(!f)return;const fd=new FormData();fd.append("file",f);try{const r=await api(`/api/events/${currentEvent}/import`,{method:"POST",body:fd});alert(`Imported ${r.imported} guests across ${r.tables} tables. Seat capacity derived from guest rows.`);data=await api(`/api/events/${currentEvent}`);render()}catch(err){alert(err.message)}e.target.value=""};
$("#guestFilter").oninput=()=>{const q=$("#guestFilter").value.toLowerCase();$("#guests").innerHTML=guestRows(data.guests.filter(g=>g.name.toLowerCase().includes(q)))};
let lookupTimer;$("#lookup").oninput=()=>{clearTimeout(lookupTimer);const q=$("#lookup").value.trim();if(!q){$("#lookupResults").innerHTML="";return}lookupTimer=setTimeout(async()=>{const rows=await api(`/api/events/${currentEvent}/search?q=${encodeURIComponent(q)}`);$("#lookupResults").innerHTML=rows.map(g=>`<div class="result"><strong>${esc(g.name)}</strong><br>Table <strong>${esc(g.table_number||"Not assigned")}</strong>${g.seat_number?` · Seat ${g.seat_number}`:""}<br><span class="muted">${g.seats||0} seats at this table</span></div>`).join("")||'<div class="muted">No matching guest.</div>'},200)};
loadEvents();