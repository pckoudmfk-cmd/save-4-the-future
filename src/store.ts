import {demoSubmissions} from "./data"; import type {Score,Stage,Submission} from "./types";
const K="stf_v1";
type DB={stage:Stage; submissions:Submission[]; scores:Record<string,Score>};
const seed:DB={stage:"submission",submissions:demoSubmissions,scores:{}};
function read():DB{try{return JSON.parse(localStorage.getItem(K)||"null")||seed}catch{return seed}}
function write(db:DB){localStorage.setItem(K,JSON.stringify(db))}
export const db={get:read,submissions:()=>read().submissions,stage:()=>read().stage,setStage:(stage:Stage)=>{const d=read();d.stage=stage;write(d)},
add:(s:Submission)=>{const d=read();d.submissions=[s,...d.submissions];write(d)},
status:(id:string,status:Submission["status"])=>{const d=read();const s=d.submissions.find(x=>x.id===id);if(s)s.status=status;write(d)},
score:(id:string,score:Score)=>{const d=read();d.scores[id]=score;write(d)},scores:()=>read().scores,
reset:()=>localStorage.removeItem(K)};
export function total(s?:Score){return s?Object.values(s).reduce((a,b)=>a+b,0):0}