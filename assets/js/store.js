
const KEY="bmc_2_0_state";
const seed={version:"2.0.0-foundation",missions:[
{id:crypto.randomUUID(),title:"Morning setup",details:"Meds, Bella, scripture, prepare for the day",done:false,active:false},
{id:crypto.randomUUID(),title:"Living room reset",details:"25-minute focused reset",done:false,active:false},
{id:crypto.randomUUID(),title:"Kitchen reset",details:"Dishes, counters, trash",done:false,active:false}
],notes:[],prayers:[],people:[],events:[],messages:[
{id:crypto.randomUUID(),role:"rachel",text:"BMC 2.0 is online. Choose one clear mission and move it forward."}
]};
export function load(){try{return JSON.parse(localStorage.getItem(KEY))||structuredClone(seed)}catch{return structuredClone(seed)}}
export function save(s){localStorage.setItem(KEY,JSON.stringify(s))}
export function reset(){localStorage.removeItem(KEY);return structuredClone(seed)}
export function backup(s){const b=new Blob([JSON.stringify(s,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="BMC_2_0_Backup.json";a.click();URL.revokeObjectURL(a.href)}
