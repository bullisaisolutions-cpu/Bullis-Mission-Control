import{load,save,reset,backup}from"./store.js";
let state=load(),view="dashboard",recognition=null,voiceListening=false,availableVoices=[],azureVoiceCatalog=[],azureLoadError="",activeAudio=null,activeAudioUrl="";
const app=document.querySelector("#app"),title=document.querySelector("#title");
const blessing="May you walk in the supernatural favor, blessing, abundance, and ability of the Most High God! May you open your eyes and see your dreams, desires, and destiny manifest in a supernaturally accelerated fashion, in Jesus' name and sealed by the Spirit of the Most High God, AMEN!";
const PREVIEW_SENTENCE="Good evening, Shane. Rachel is online and ready to help you take control of today’s mission.";
const DEFAULT_AZURE_VOICE="en-AU-NatashaNeural";
const FEATURED_VOICES=["Natasha","Annette","Carly","William","Sonia","Libby","Olivia","Ryan","Emily","Connor","Molly","Mitchell","Leah","Luke","Clara","Liam","Neerja","Prabhat","Luna","Wayne","Asilia","Chilemba","Ezinne","Abeo","Rosa","James"];
const COUNTRY_FILTERS={all:"All English",au:"Australia",gb:"United Kingdom",ie:"Ireland",nz:"New Zealand",za:"South Africa",ca:"Canada",in:"India",sg:"Singapore",ke:"Kenya",ng:"Nigeria",ph:"Philippines"};
const esc=s=>String(s??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const names={dashboard:"Dashboard",missions:"Missions",rachel:"Rachel",calendar:"Calendar",prayer:"Prayer",notes:"Notes",people:"People",settings:"Settings"};

function ensureVoiceSettings(){
  state.voiceSettings ??= {assistantName:"Rachel",gender:"female",accent:"all",voiceURI:"",rate:.92,pitch:1,volume:1,autoBlessing:true,azureVoice:DEFAULT_AZURE_VOICE,favoriteVoices:[],countryFilter:"all",genderFilter:"all",searchTerm:""};
  state.voiceSettings.assistantName ??= "Rachel";
  state.voiceSettings.azureVoice ??= DEFAULT_AZURE_VOICE;
  state.voiceSettings.favoriteVoices ??= [];
  state.voiceSettings.countryFilter ??= "all";
  state.voiceSettings.genderFilter ??= "all";
  state.voiceSettings.searchTerm ??= "";
}

function loadVoices(){
  if(!("speechSynthesis"in window)) return;
  availableVoices=speechSynthesis.getVoices().filter(v=>/^en(-|_)/i.test(v.lang||""));
  render();
}

if("speechSynthesis"in window){speechSynthesis.onvoiceschanged=loadVoices;loadVoices();}

function inferredGender(name){
  const n=(name||"").toLowerCase();
  const f=["zira","samantha","aria","jenny","sonia","libby","natasha","catherine","neerja","diya","meera","luna","rosa","yan","female"];
  const m=["david","mark","ryan","james","william","prabhat","arjun","wayne","sam","male"];
  if(f.some(x=>n.includes(x)))return"female";
  if(m.some(x=>n.includes(x)))return"male";
  return"unknown";
}

function accentGroup(v){
  const l=(v.lang||"").toLowerCase();
  if(l.includes("en-au"))return"Australian English";
  if(l.includes("en-gb"))return"UK English";
  if(l.includes("en-in"))return"Indian English";
  if(l.includes("en-sg"))return"Singapore English";
  if(l.includes("en-ph"))return"Philippines English";
  if(l.includes("en-hk"))return"Hong Kong English";
  if(l.includes("en-nz"))return"New Zealand English";
  if(l.includes("en-za"))return"South African English";
  if(l.includes("en-ca"))return"Canadian English";
  if(l.includes("en-ie"))return"Irish English";
  if(l.includes("en-us"))return"US English";
  return v.lang||"English";
}

function getCountryKey(locale){
  const l=(locale||"").toLowerCase();
  if(l.startsWith("en-au"))return"au";
  if(l.startsWith("en-gb"))return"gb";
  if(l.startsWith("en-ie"))return"ie";
  if(l.startsWith("en-nz"))return"nz";
  if(l.startsWith("en-za"))return"za";
  if(l.startsWith("en-ca"))return"ca";
  if(l.startsWith("en-in"))return"in";
  if(l.startsWith("en-sg"))return"sg";
  if(l.startsWith("en-ke"))return"ke";
  if(l.startsWith("en-ng"))return"ng";
  if(l.startsWith("en-ph"))return"ph";
  return"all";
}

function selectedVoice(){
  ensureVoiceSettings();
  return availableVoices.find(v=>v.voiceURI===state.voiceSettings.voiceURI)||availableVoices.find(v=>inferredGender(v.name)===state.voiceSettings.gender)||availableVoices[0];
}

function stopAudioPlayback(){
  if(activeAudioUrl){
    try{URL.revokeObjectURL(activeAudioUrl);}catch{}
    activeAudioUrl="";
  }
  if(activeAudio){
    try{activeAudio.pause();activeAudio.currentTime=0;}catch{}
    activeAudio=null;
  }
  if("speechSynthesis"in window){
    try{speechSynthesis.cancel();}catch{}
  }
}

async function synthesizeAzureSpeech(text, voiceName = state.voiceSettings.azureVoice || DEFAULT_AZURE_VOICE){
  const response=await fetch("/.netlify/functions/azure-tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text,voice:voiceName,rate:Number(state.voiceSettings.rate||.92),pitch:Number(state.voiceSettings.pitch||1)})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){throw new Error(payload?.error||"Azure speech synthesis failed.");}
  const blob=await response.blob();
  if(!blob || blob.size===0){throw new Error("Azure returned an empty audio response.");}
  return URL.createObjectURL(blob);
}

async function speak(text){
  if(!text||!String(text).trim()) return;
  ensureVoiceSettings();
  stopAudioPlayback();
  try{
    const azureVoiceName=state.voiceSettings.azureVoice || DEFAULT_AZURE_VOICE;
    if(azureVoiceName){
      const url=await synthesizeAzureSpeech(text, azureVoiceName);
      activeAudioUrl=url;
      activeAudio=new Audio(url);
      activeAudio.onended=()=>{if(activeAudioUrl===url){try{URL.revokeObjectURL(url);}catch{};activeAudioUrl="";activeAudio=null;}};
      activeAudio.onerror=()=>{try{URL.revokeObjectURL(url);}catch{};activeAudioUrl="";activeAudio=null;fallbackSpeech(text);};
      await activeAudio.play();
      return;
    }
  }catch(error){
    console.warn("Azure TTS playback failed, falling back to browser speech:",error);
  }
  fallbackSpeech(text);
}

function fallbackSpeech(text){
  if(!("speechSynthesis"in window)){alert("Speech playback is not supported in this browser.");return;}
  const u=new SpeechSynthesisUtterance(text),v=selectedVoice();
  if(v)u.voice=v;
  u.rate=Number(state.voiceSettings.rate||.92);
  u.pitch=Number(state.voiceSettings.pitch||1);
  u.volume=Number(state.voiceSettings.volume||1);
  speechSynthesis.speak(u);
}

function startGreetingListener(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){alert("Voice greeting is not supported in this browser.");return;}
  if(recognition){try{recognition.stop();}catch{}}
  recognition=new SR();recognition.lang="en-US";recognition.continuous=true;recognition.interimResults=false;
  recognition.onstart=()=>{voiceListening=true;render();};
  recognition.onresult=e=>{const heard=Array.from(e.results).slice(e.resultIndex).map(r=>r[0].transcript).join(" ").toLowerCase();ensureVoiceSettings();const wake=`good morning ${state.voiceSettings.assistantName}`.toLowerCase();if(heard.includes(wake)){if(state.voiceSettings.autoBlessing)speak(blessing);state.messages.push({id:crypto.randomUUID(),role:"rachel",text:blessing});save(state);}};
  recognition.onend=()=>{if(voiceListening){try{recognition.start();}catch{}}};
  recognition.start();
}

function stopGreetingListener(){
  voiceListening=false;
  if(recognition){try{recognition.stop();}catch{}}
  render();
}

function dashboard(){
  ensureVoiceSettings();
  const done=state.missions.filter(m=>m.done).length,total=state.missions.length,pct=total?Math.round(done/total*100):0,next=state.missions.find(m=>m.active&&!m.done)||state.missions.find(m=>!m.done);
  return `<div class="card hero"><p class="muted">${esc(state.voiceSettings.assistantName)} RECITES GOD'S BLESSING TO HIS ANOINTED</p><h2>Centralize the day with God</h2><p>${esc(blessing)}</p><div class="actions"><button class="btn" data-act="speakBlessing">?? Hear the Blessing</button><button class="btn" data-act="${voiceListening?"stopVoice":"startVoice"}">${voiceListening?"?? Stop Voice Greeting":`?? Enable “Good morning, ${esc(state.voiceSettings.assistantName)}”`}</button></div></div><div class="grid cols2" style="margin-top:1rem"><div class="card hero"><p class="muted">MISSION ADVISOR</p><h2>${esc(state.voiceSettings.assistantName)}</h2><p>${next?`Your next move is <b>${esc(next.title)}</b>. Keep it small and finishable.`:"Everything listed is complete."}</p><button class="btn" data-act="startNext">Start Next Mission</button></div><div class="card"><h2>Current Mission</h2>${next?`<div class="name">${esc(next.title)}</div><p class="muted">${esc(next.details)}</p>`:"<p class='muted'>No open mission.</p>"}</div></div><div class="grid cols4" style="margin-top:1rem"><div class="card stat"><strong>${done}</strong><span>Complete</span></div><div class="card stat"><strong>${total-done}</strong><span>Remaining</span></div><div class="card stat"><strong>${pct}%</strong><span>Progress</span></div><div class="card stat"><strong>${state.prayers.length}</strong><span>Prayers</span></div></div>`;
}

function listPage(key,label,icon){
  const rows=state[key].map(x=>`<div class="item"><span>${icon}</span><div><div class="name">${esc(x.title)}</div><div class="muted">${esc(x.details)}</div></div><button class="btn small" data-del="${key}" data-id="${x.id}">Delete</button></div>`).join("");
  return `<div class="card"><div class="row" style="justify-content:space-between"><h2>${label}</h2><button class="btn" data-new="${key}">Add</button></div><div class="list">${rows||"<p class='muted'>Nothing added yet.</p>"}</div></div>`;
}

function missions(){
  const rows=state.missions.map(m=>`<div class="item ${m.done?"done":""}"><input type="checkbox" data-check="${m.id}" ${m.done?"checked":""}><div><div class="name">${esc(m.title)}</div><div class="muted">${esc(m.details)} ${m.active?"• Active":""}</div></div><div class="actions"><button class="btn small" data-start="${m.id}">Start</button><button class="btn small" data-delete-mission="${m.id}">Delete</button></div></div>`).join("");
  return `<div class="card"><div class="row" style="justify-content:space-between"><h2>Mission Center</h2><button class="btn" data-new="missions">Add Mission</button></div><div class="list">${rows}</div></div>`;
}

function getAzureFilteredVoices(){
  const term=(state.voiceSettings.searchTerm||"").trim().toLowerCase();
  const country=state.voiceSettings.countryFilter||"all";
  const gender=state.voiceSettings.genderFilter||"all";
  return azureVoiceCatalog.filter(v=>{
    const countryOk=country==="all"||getCountryKey(v.locale)===country;
    const genderOk=gender==="all"||String(v.gender||"").toLowerCase()===gender;
    const searchText=[v.displayName,v.localName,v.shortName,v.locale,v.localeName].join(" ").toLowerCase();
    const termOk=!term||searchText.includes(term);
    return countryOk&&genderOk&&termOk;
  });
}

function getFeaturedAzureVoices(){
  const names=FEATURED_VOICES.map(x=>x.toLowerCase());
  return azureVoiceCatalog.filter(v=>{
    const haystack=[v.displayName,v.localName,v.shortName].join(" ").toLowerCase();
    return names.some(name=>haystack.includes(name));
  });
}

function voiceStudio(){
  ensureVoiceSettings();
  const accents=[...new Set(availableVoices.map(accentGroup))].sort();
  const filtered=availableVoices.filter(v=>{const g=inferredGender(v.name),genderOK=state.voiceSettings.gender==="all"||g===state.voiceSettings.gender||g==="unknown",accentOK=state.voiceSettings.accent==="all"||accentGroup(v)===state.voiceSettings.accent;return genderOK&&accentOK;});
  const selectedAzureVoice=azureVoiceCatalog.find(v=>v.shortName===state.voiceSettings.azureVoice)||azureVoiceCatalog[0]||null;
  const featuredVoices=getFeaturedAzureVoices().filter(v=>getAzureFilteredVoices().some(f=>f.shortName===v.shortName));
  const allVoices=getAzureFilteredVoices();

  return `<div class="voice-studio"><div class="card hero voice-header"><div><p class="muted">BMC 2.1.1</p><h2>Voice Studio</h2></div><button class="btn" data-act="saveVoiceStudio">Save Voice Studio</button></div><div class="grid cols2" style="margin-top:1rem"><div class="card"><label>Assistant name<input id="assistantName" value="${esc(state.voiceSettings.assistantName)}"></label><label>Voice identity<select id="voiceGender"><option value="female" ${state.voiceSettings.gender==="female"?"selected":""}>Female</option><option value="male" ${state.voiceSettings.gender==="male"?"selected":""}>Male</option><option value="all" ${state.voiceSettings.gender==="all"?"selected":""}>All voices</option></select></label><label>Accent<select id="voiceAccent"><option value="all">All English accents</option>${accents.map(a=>`<option value="${esc(a)}" ${state.voiceSettings.accent===a?"selected":""}>${esc(a)}</option>`).join("")}</select></label><label>Voice<select id="voiceURI">${filtered.map(v=>`<option value="${esc(v.voiceURI)}" ${state.voiceSettings.voiceURI===v.voiceURI?"selected":""}>${esc(v.name)} — ${esc(accentGroup(v))}</option>`).join("")}</select></label><div class="voice-grid"><label>Speed <span id="rateValue">${state.voiceSettings.rate}</span><input id="voiceRate" type="range" min=".6" max="1.4" step=".05" value="${state.voiceSettings.rate}"></label><label>Pitch <span id="pitchValue">${state.voiceSettings.pitch}</span><input id="voicePitch" type="range" min=".5" max="1.5" step=".05" value="${state.voiceSettings.pitch}"></label><label>Volume <span id="volumeValue">${state.voiceSettings.volume}</span><input id="voiceVolume" type="range" min="0" max="1" step=".05" value="${state.voiceSettings.volume}"></label></div><label><input id="autoBlessing" type="checkbox" ${state.voiceSettings.autoBlessing?"checked":""}> Auto-play blessing on “Good morning”</label></div><div class="card"><h3>Azure Global Voice Pack</h3><div class="voice-filter-row"><label>Country / dialect<select id="azureCountryFilter">${Object.entries(COUNTRY_FILTERS).map(([key,label])=>`<option value="${key}" ${state.voiceSettings.countryFilter===key?"selected":""}>${label}</option>`).join("")}</select></label><label>Gender<select id="azureGenderFilter"><option value="all" ${state.voiceSettings.genderFilter==="all"?"selected":""}>All</option><option value="female" ${state.voiceSettings.genderFilter==="female"?"selected":""}>Female</option><option value="male" ${state.voiceSettings.genderFilter==="male"?"selected":""}>Male</option></select></label></div><label>Search<input id="azureVoiceSearch" value="${esc(state.voiceSettings.searchTerm)}" placeholder="Search by voice, locale, or country..."></label>${azureLoadError?`<p class="muted status-message">${esc(azureLoadError)}</p>`:`<p class="muted status-message">${azureVoiceCatalog.length?`${azureVoiceCatalog.length} English Azure voices loaded.`:"Loading Azure voices..."}</p>`}<div class="selected-voice-box">${selectedAzureVoice?`<strong>${esc(selectedAzureVoice.displayName||selectedAzureVoice.shortName)}</strong><div>${esc(selectedAzureVoice.localeName||selectedAzureVoice.locale||"English")}</div><div class="voice-meta">${esc(selectedAzureVoice.gender||"Unknown")} • ${esc(selectedAzureVoice.locale||"en-US")}</div>`:`<span class="muted">No Azure voice selected.</span>`}</div><div class="actions" style="margin-top:.8rem"><button class="btn" data-act="previewVoice">Preview Voice</button><button class="btn secondary" data-act="stopVoice">Stop</button></div></div></div><div class="card" style="margin-top:1rem"><h3>Featured voices</h3>${featuredVoices.length?`<div class="voice-grid-list">${featuredVoices.map(v=>`<article class="voice-card ${state.voiceSettings.azureVoice===v.shortName?"active":""}"><div class="voice-card-head"><div><strong>${esc(v.displayName||v.shortName)}</strong><div class="muted">${esc(v.localeName||v.locale||"English")}</div></div><button class="btn small favorite-btn" data-favorite-toggle="${esc(v.shortName)}" type="button">${state.voiceSettings.favoriteVoices.includes(v.shortName)?"? Unfavorite":"? Favorite"}</button></div><div class="voice-meta">${esc(v.gender||"Unknown")} • ${esc(v.locale||"en-US")} • ${esc(v.voiceType||"Neural")}</div><div class="actions"><button class="btn small" data-azure-preview="${esc(v.shortName)}" type="button">Preview</button><button class="btn small secondary" data-azure-stop="${esc(v.shortName)}" type="button">Stop</button><button class="btn small" data-voice-select="${esc(v.shortName)}" type="button">Use Voice</button></div></article>`).join("")}</div>`:`<p class="muted">No featured English voices are available in the live Azure catalog.</p>`}</div><div class="card" style="margin-top:1rem"><h3>All English voices</h3>${allVoices.length?`<div class="voice-grid-list">${allVoices.map(v=>`<article class="voice-card ${state.voiceSettings.azureVoice===v.shortName?"active":""}"><div class="voice-card-head"><div><strong>${esc(v.displayName||v.shortName)}</strong><div class="muted">${esc(v.localName||v.displayName||v.shortName)}</div></div><button class="btn small favorite-btn" data-favorite-toggle="${esc(v.shortName)}" type="button">${state.voiceSettings.favoriteVoices.includes(v.shortName)?"?":"?"}</button></div><div class="voice-meta">${esc(v.localeName||v.locale||"English")} • ${esc(v.gender||"Unknown")} • ${esc(v.voiceType||"Neural")}</div><div class="actions"><button class="btn small" data-azure-preview="${esc(v.shortName)}" type="button">Preview</button><button class="btn small secondary" data-azure-stop="${esc(v.shortName)}" type="button">Stop</button><button class="btn small" data-voice-select="${esc(v.shortName)}" type="button">Use Voice</button></div></article>`).join("")}</div>`:`<p class="muted">No Azure English voices match the current filter.</p>`}</div></div>`;
}

function rachel(){
  ensureVoiceSettings();
  const msgs=state.messages.map(m=>`<div class="card" style="margin:.5rem 0;max-width:80%;${m.role==="user"?"margin-left:auto;background:#2f5f9d;color:white":""}">${esc(m.text)}</div>`).join("");
  return `<div class="grid cols2"><div class="card"><h2>${esc(state.voiceSettings.assistantName)}</h2><div>${msgs}</div><textarea id="rachelInput" placeholder="Tell ${esc(state.voiceSettings.assistantName)} what you need..."></textarea><button class="btn" id="sendRachel" style="margin-top:.5rem">Send</button></div><div class="card hero"><h2>God-Centered Mission Advisor</h2><p>${esc(state.voiceSettings.assistantName)} begins the day by reciting God's blessing to His anointed.</p><button class="btn" data-act="speakBlessing">Hear the Blessing</button></div></div>`;
}

function settings(){
  ensureVoiceSettings();
  return `<div class="grid cols2"><div class="card"><h2>Backup</h2><button class="btn" data-act="backup">Export Backup</button><p><label class="btn">Restore Backup<input type="file" id="restore" accept="application/json" hidden></label></p></div><div class="card"><h2>System</h2><p>Version: 2.1.1-develop</p><button class="btn" data-act="reset">Reset Local Data</button></div><div class="card hero"><p class="muted">VOICE STUDIO</p><h2>${esc(state.voiceSettings.assistantName)}</h2><p>${esc((azureVoiceCatalog.find(v=>v.shortName===state.voiceSettings.azureVoice)?.displayName)||selectedVoice()?.name||"Default browser voice")}</p><button class="btn" data-act="openVoiceStudio">Open Voice Studio</button></div><div class="card"><h2>Voice Greeting</h2><p>Say <strong>“Good morning, ${esc(state.voiceSettings.assistantName)}.”</strong></p><button class="btn" data-act="${voiceListening?"stopVoice":"startVoice"}">${voiceListening?"Stop Listening":"Enable Voice Greeting"}</button></div></div>`;
}

function render(){
  title.textContent=names[view]||"Voice Studio";
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  app.innerHTML=view==="dashboard"?dashboard():view==="missions"?missions():view==="rachel"?rachel():view==="calendar"?listPage("events","Calendar","??"):view==="prayer"?listPage("prayers","Prayer Journal","??"):view==="notes"?listPage("notes","Notes","??"):view==="people"?listPage("people","People","??"):view==="voiceStudio"?voiceStudio():settings();
  bind();
}

function persist(){save(state);render();}

function add(key){const t=prompt("Title:");if(!t)return;const d=prompt("Details:")||"";state[key].push({id:crypto.randomUUID(),title:t,details:d,...(key==="missions"?{done:false,active:false}:{})});persist();}

function updateVoiceSettingsFromForm(doSave){
  ensureVoiceSettings();
  const name=document.querySelector("#assistantName")?.value.trim();
  if(name)state.voiceSettings.assistantName=name;
  state.voiceSettings.gender=document.querySelector("#voiceGender")?.value||state.voiceSettings.gender;
  state.voiceSettings.accent=document.querySelector("#voiceAccent")?.value||state.voiceSettings.accent;
  state.voiceSettings.voiceURI=document.querySelector("#voiceURI")?.value||"";
  state.voiceSettings.rate=Number(document.querySelector("#voiceRate")?.value||.92);
  state.voiceSettings.pitch=Number(document.querySelector("#voicePitch")?.value||1);
  state.voiceSettings.volume=Number(document.querySelector("#voiceVolume")?.value||1);
  state.voiceSettings.autoBlessing=Boolean(document.querySelector("#autoBlessing")?.checked);
  state.voiceSettings.countryFilter=document.querySelector("#azureCountryFilter")?.value||state.voiceSettings.countryFilter||"all";
  state.voiceSettings.genderFilter=document.querySelector("#azureGenderFilter")?.value||state.voiceSettings.genderFilter||"all";
  state.voiceSettings.searchTerm=document.querySelector("#azureVoiceSearch")?.value||state.voiceSettings.searchTerm||"";
  if(doSave)save(state);
}

async function previewAzureVoice(voiceName,text=PREVIEW_SENTENCE){
  ensureVoiceSettings();
  stopAudioPlayback();
  try{
    const url=await synthesizeAzureSpeech(text, voiceName);
    activeAudioUrl=url;
    activeAudio=new Audio(url);
    activeAudio.addEventListener("ended",()=>{try{URL.revokeObjectURL(url);}catch{};activeAudioUrl="";activeAudio=null;});
    activeAudio.addEventListener("error",()=>{try{URL.revokeObjectURL(url);}catch{};activeAudioUrl="";activeAudio=null;fallbackSpeech(text);});
    await activeAudio.play();
  }catch(error){
    console.warn("Preview failed:",error);
    fallbackSpeech(text);
  }
}

function bind(){
  document.querySelectorAll("[data-new]").forEach(b=>b.onclick=()=>add(b.dataset.new));
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{state[b.dataset.del]=state[b.dataset.del].filter(x=>x.id!==b.dataset.id);persist();});
  document.querySelectorAll("[data-check]").forEach(c=>c.onchange=()=>{const m=state.missions.find(x=>x.id===c.dataset.check);if(m){m.done=c.checked;m.active=false;persist();}});
  document.querySelectorAll("[data-start]").forEach(b=>b.onclick=()=>{state.missions.forEach(m=>m.active=false);const mission=state.missions.find(x=>x.id===b.dataset.start);if(mission)mission.active=true;persist();});
  document.querySelectorAll("[data-delete-mission]").forEach(b=>b.onclick=()=>{state.missions=state.missions.filter(x=>x.id!==b.dataset.deleteMission);persist();});
  document.querySelectorAll("[data-favorite-toggle]").forEach(btn=>btn.onclick=()=>{const voice=btn.dataset.favoriteToggle;const list=state.voiceSettings.favoriteVoices||[];state.voiceSettings.favoriteVoices=list.includes(voice)?list.filter(v=>v!==voice):[...list,voice];save(state);render();});
  document.querySelectorAll("[data-voice-select]").forEach(btn=>btn.onclick=()=>{state.voiceSettings.azureVoice=btn.dataset.voiceSelect;save(state);render();});
  document.querySelectorAll("[data-azure-preview]").forEach(btn=>btn.onclick=()=>{const selection=btn.dataset.azurePreview;state.voiceSettings.azureVoice=selection;save(state);previewAzureVoice(selection,PREVIEW_SENTENCE);});
  document.querySelectorAll("[data-azure-stop]").forEach(btn=>btn.onclick=()=>stopAudioPlayback());
  document.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{
    const a=b.dataset.act;
    if(a==="startNext"){state.missions.forEach(m=>m.active=false);const n=state.missions.find(m=>!m.done);if(n)n.active=true;persist();}
    if(a==="backup")backup(state);
    if(a==="reset"&&confirm("Reset BMC local data?")){state=reset();render();}
    if(a==="speakBlessing")speak(blessing);
    if(a==="startVoice")startGreetingListener();
    if(a==="stopVoice")stopAudioPlayback();
    if(a==="openVoiceStudio"){view="voiceStudio";render();if(!azureVoiceCatalog.length)loadAzureVoices();}
    if(a==="previewVoice"){updateVoiceSettingsFromForm(false);state.voiceSettings.azureVoice=state.voiceSettings.azureVoice||DEFAULT_AZURE_VOICE;previewAzureVoice(state.voiceSettings.azureVoice,PREVIEW_SENTENCE);}
    if(a==="saveVoiceStudio"){updateVoiceSettingsFromForm(true);view="settings";render();}
  });

  const gender=document.querySelector("#voiceGender"),accent=document.querySelector("#voiceAccent");
  if(gender)gender.onchange=()=>{state.voiceSettings.gender=gender.value;state.voiceSettings.voiceURI="";render();};
  if(accent)accent.onchange=()=>{state.voiceSettings.accent=accent.value;state.voiceSettings.voiceURI="";render();};

  [["voiceRate","rateValue"],["voicePitch","pitchValue"],["voiceVolume","volumeValue"]].forEach(([id,labelId])=>{
    const input=document.querySelector("#"+id),out=document.querySelector("#"+labelId);
    if(input&&out){input.oninput=()=>{out.textContent=input.value;if(id==="voiceRate")state.voiceSettings.rate=Number(input.value);if(id==="voicePitch")state.voiceSettings.pitch=Number(input.value);if(id==="voiceVolume")state.voiceSettings.volume=Number(input.value);}};
  });

  const autoBlessing=document.querySelector("#autoBlessing");
  if(autoBlessing)autoBlessing.onchange=()=>{state.voiceSettings.autoBlessing=autoBlessing.checked;save(state);};

  const countryFilter=document.querySelector("#azureCountryFilter");
  if(countryFilter)countryFilter.onchange=()=>{state.voiceSettings.countryFilter=countryFilter.value;save(state);render();};

  const azureGenderFilter=document.querySelector("#azureGenderFilter");
  if(azureGenderFilter)azureGenderFilter.onchange=()=>{state.voiceSettings.genderFilter=azureGenderFilter.value;save(state);render();};

  const searchInput=document.querySelector("#azureVoiceSearch");
  if(searchInput)searchInput.oninput=()=>{state.voiceSettings.searchTerm=searchInput.value;save(state);render();};

  const assistantName=document.querySelector("#assistantName");
  if(assistantName)assistantName.oninput=()=>{state.voiceSettings.assistantName=assistantName.value.trim()||"Rachel";save(state);};

  document.querySelector("nav").onclick=e=>{const b=e.target.closest("[data-view]");if(b){view=b.dataset.view;render();}};

  const q=document.querySelector("#quickDialog");
  document.querySelector("#quickAdd").onclick=()=>q.showModal();
  document.querySelector("#saveItem").onclick=e=>{const key=document.querySelector("#type").value,t=document.querySelector("#itemTitle").value.trim(),d=document.querySelector("#details").value.trim();if(!t){e.preventDefault();return;}state[key].push({id:crypto.randomUUID(),title:t,details:d,...(key==="missions"?{done:false,active:false}:{})});save(state);document.querySelector("#quickForm").reset();render();};

  if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js"));
  ensureVoiceSettings();
  if(!azureVoiceCatalog.length)loadAzureVoices();
  render();
}

async function loadAzureVoices(){
  if(!fetch){azureLoadError="Azure voice catalog is unavailable in this browser.";render();return;}
  try{
    const response=await fetch("/.netlify/functions/azure-voices");
    if(!response.ok){
      const payload=await response.json().catch(()=>({}));
      throw new Error(payload?.error||`Azure voices request failed (${response.status}).`);
    }
    const payload=await response.json();
    const voices=Array.isArray(payload)?payload:[];
    azureVoiceCatalog=voices.filter(v=>v&&v.shortName&&v.locale).sort((a,b)=>{const locale=(a.locale||"").localeCompare(b.locale||"");if(locale)return locale;const gender=(a.gender||"").localeCompare(b.gender||"");if(gender)return gender;return (a.displayName||"").localeCompare(b.displayName||"");});
    azureLoadError="";
    const selectedExists=azureVoiceCatalog.some(v=>v.shortName===state.voiceSettings.azureVoice);
    if(!selectedExists){const defaultVoice=azureVoiceCatalog.find(v=>v.shortName===DEFAULT_AZURE_VOICE)||azureVoiceCatalog[0];state.voiceSettings.azureVoice=(defaultVoice&&defaultVoice.shortName)?defaultVoice.shortName:DEFAULT_AZURE_VOICE;}
    if(!Array.isArray(state.voiceSettings.favoriteVoices))state.voiceSettings.favoriteVoices=[];
    save(state);
    render();
  }catch(error){
    console.warn("Azure voice catalog failed:",error);
    azureLoadError="Azure voices are unavailable right now. Browser speech remains available as a fallback.";
    state.voiceSettings.azureVoice ??= DEFAULT_AZURE_VOICE;
    render();
  }
}

if("speechSynthesis"in window){speechSynthesis.onvoiceschanged=loadVoices;loadVoices();}
loadAzureVoices();