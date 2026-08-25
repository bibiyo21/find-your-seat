const $=s=>document.querySelector(s);
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function load(){
  const eventId=location.pathname.split("/").filter(Boolean)[1];
  const r=await fetch(`/api/events/${eventId}`);
  const data=await r.json();
  if(!r.ok){$("#chart").innerHTML=`<p class="muted">${esc(data.error||"Could not load event.")}</p>`;return}
  $("#eventName").textContent=data.event.name;
  const byTable=new Map();
  data.tables.slice().sort((a,b)=>String(a.table_number||"").localeCompare(String(b.table_number||""),undefined,{numeric:true})).forEach(t=>byTable.set(t.table_number,{table:t,guests:[]}));
  data.guests.forEach(g=>{
    const key=g.table_number||"Unassigned";
    if(!byTable.has(key))byTable.set(key,{table:{table_number:key,seats:0},guests:[]});
    byTable.get(key).guests.push(g);
  });
  $("#chart").innerHTML=[...byTable.values()].map(({table,guests})=>`
    <div class="tableBlock">
      <h2>Table ${esc(table.table_number)} <span class="muted" style="font-size:14px;font-weight:normal;">(${table.seats} seats · ${guests.length} guests)</span></h2>
      <ul>${guests.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(g=>`<li>${esc(g.name)}${g.seat_number?` — Seat ${g.seat_number}`:""}</li>`).join("")||'<li class="muted">No guests assigned.</li>'}</ul>
    </div>
  `).join("");
}
$("#printBtn").onclick=()=>window.print();
load();
