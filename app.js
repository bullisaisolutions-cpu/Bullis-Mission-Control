const STORAGE_KEY = "bmc_v1_3_state";
const defaultMissions = [
  {id:crypto.randomUUID(),title:"Morning setup",minutes:15,done:false,active:false},
  {id:crypto.randomUUID(),title:"Living room reset",minutes:25,done:false,active:false},
  {id:crypto.randomUUID(),title:"Kitchen reset",minutes:25,done:false,active:false},
  {id:crypto.randomUUID(),title:"Laundry and clothing",minutes:25,done:false,active:false},
  {id:crypto.randomUUID(),title:"Bedroom reset",minutes:25,done:false,active:false},
  {id:crypto.randomUUID(),title:"Bathroom reset",minutes:20,done:false,active:false},
  {id:crypto.randomUUID(),title:"Trash and final walkthrough",minutes:15,done:false,active:false}
];
let state = loadState();
let deferredPrompt = null;

function loadState(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && Array.isArray(saved.missions) ? saved : {missions:defaultMissions,notes:""};
  }catch{return {missions:defaultMissions,notes:""}}
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));render()}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}

function render(){
  const complete=state.missions.filter(m=>m.done).length;
  const total=state.missions.length;
  const pct=total?Math.round(complete/total*100):0;
  document.querySelector("#completeCount").textContent=complete;
  document.querySelector("#remainingCount").textContent=total-complete;
  document.querySelector("#progressPercent").textContent=pct+"%";
  document.querySelector("#progressText").textContent=`${complete} of ${total}`;
  document.querySelector("#progressBar").style.width=pct+"%";
  const active=state.missions.find(m=>m.active&&!m.done);
  document.querySelector("#currentMission").innerHTML=active
    ? `<strong>${esc(active.title)}</strong><div class="mission-meta">${active.minutes} minutes</div>`
    : (complete===total&&total ? "All missions complete. Outstanding work." : "No mission started yet.");
  document.querySelector("#advisorMessage").textContent =
    complete===total&&total ? "Mission accomplished. Take the win—you earned it." :
    active ? `Stay with “${active.title}.” Finish this one before chasing the next.` :
    "One mission at a time. Progress beats perfection.";

  document.querySelector("#missionList").innerHTML=state.missions.map(m=>`
    <div class="mission-row ${m.done?"done":""}">
      <input type="checkbox" aria-label="Complete ${esc(m.title)}" ${m.done?"checked":""} onchange="toggleMission('${m.id}')">
      <div>
        <div class="mission-title">${esc(m.title)}</div>
        <div class="mission-meta">${m.minutes} minutes ${m.active&&!m.done?"• Active":""}</div>
      </div>
      <button class="icon-btn danger delete" aria-label="Delete ${esc(m.title)}" onclick="deleteMission('${m.id}')">Delete</button>
    </div>`).join("") || "<p class='muted'>No missions yet.</p>";
}
window.toggleMission=id=>{
  const m=state.missions.find(x=>x.id===id); if(!m)return;
  m.done=!m.done;m.active=false;saveState()
};
window.deleteMission=id=>{state.missions=state.missions.filter(x=>x.id!==id);saveState()};

document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".tab,.view").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");document.querySelector("#"+btn.dataset.view).classList.add("active")
}));
document.querySelector("#startNextBtn").addEventListener("click",()=>{
  state.missions.forEach(m=>m.active=false);
  const next=state.missions.find(m=>!m.done);if(next)next.active=true;saveState()
});
document.querySelector("#resetDayBtn").addEventListener("click",()=>{
  if(confirm("Reset all mission progress for a new day?")){
    state.missions.forEach(m=>{m.done=false;m.active=false});saveState()
  }
});
const dialog=document.querySelector("#missionDialog");
document.querySelector("#addMissionBtn").addEventListener("click",()=>dialog.showModal());
document.querySelector("#saveMissionBtn").addEventListener("click",e=>{
  const title=document.querySelector("#missionName").value.trim();
  const minutes=Number(document.querySelector("#missionMinutes").value);
  if(!title||!minutes){e.preventDefault();return}
  state.missions.push({id:crypto.randomUUID(),title,minutes,done:false,active:false});
  document.querySelector("#missionForm").reset();saveState()
});
const notes=document.querySelector("#notesArea");notes.value=state.notes||"";
notes.addEventListener("input",()=>{state.notes=notes.value;localStorage.setItem(STORAGE_KEY,JSON.stringify(state))});

document.querySelector("#exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString(),version:"1.3"},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="BMC_1_3_Backup.json";a.click();URL.revokeObjectURL(a.href)
});
document.querySelector("#restoreInput").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const restored=JSON.parse(await file.text());
    if(!Array.isArray(restored.missions))throw new Error("Invalid backup");
    state={missions:restored.missions,notes:restored.notes||""};notes.value=state.notes;saveState();alert("Backup restored.")
  }catch(err){alert("That file is not a valid BMC backup.")}
  e.target.value=""
});

document.querySelector("#dictateBtn").addEventListener("click",()=>{
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const status=document.querySelector("#dictationStatus");
  if(!SpeechRecognition){status.textContent="Voice dictation is not supported in this browser.";return}
  const recognition=new SpeechRecognition();recognition.lang="en-US";recognition.interimResults=false;
  status.textContent="Listening…";
  recognition.onresult=e=>{const text=e.results[0][0].transcript;notes.value+=(notes.value?" ":"")+text;state.notes=notes.value;saveState();status.textContent="Dictation added."};
  recognition.onerror=()=>status.textContent="Dictation could not be completed.";
  recognition.onend=()=>setTimeout(()=>status.textContent="",2500);recognition.start()
});

window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;document.querySelector("#installBtn").classList.remove("hidden")});
document.querySelector("#installBtn").addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.querySelector("#installBtn").classList.add("hidden")});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js"));
render();
