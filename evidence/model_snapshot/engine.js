/* Shared browser / Node engine. Data is injected explicitly for reproducibility. */
(function(root){
'use strict';
const STATES=['answered','clarify','not_found','conflict','refused'];
const norm=s=>String(s).toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9%\u0900-\u097f]+/g,' ').trim();
const words=s=>norm(s).split(/\s+/).filter(t=>t.length>2&&!new Set(['what','when','where','how','the','for','are','can','and','with','about','does','university','bennett','please','tell','have','this','that','will','from']).has(t));
function retrieve(question,corpus,k=4){
 const q=norm(question),qt=words(question),N=corpus.facts.length;
 const docs=corpus.facts.map(f=>words([f.topic,f.text,...f.aliases].join(' '))),avg=docs.reduce((a,d)=>a+d.length,0)/N;
 return corpus.facts.map((f,i)=>{
  let score=0;for(const w of new Set(qt)){let df=docs.filter(d=>d.includes(w)).length,tf=docs[i].filter(t=>t===w).length;score+=Math.log(1+(N-df+.5)/(df+.5))*(tf*2.2/(tf+1.2*(.25+.75*docs[i].length/avg)));}
  let alias=f.aliases.filter(a=>(' '+q+' ').includes(' '+norm(a)+' ')).sort((a,b)=>b.length-a.length)[0];
  return {...f,score:+(score+(alias?8+norm(alias).split(' ').length:0)).toFixed(3),alias_match:alias||null};
 }).filter(f=>f.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,k);
}
function resolve(question,scope={},corpus){
 let q=norm(question),rank=retrieve(question,corpus),s={...scope};
 const year=question.match(/20\d{2}[-–/]\d{2,4}/);if(year)s.year=year[0].replace(/[–/]/g,'-');
 if(/\bodd\b|december/.test(q))s.semester='Odd';if(/\beven\b|january/.test(q))s.semester='Even';
 if(/freshman|fresher|freshers|new student/.test(q))s.audience='Freshman';if(/returning|senior/.test(q))s.audience='Returning';
 if(/scset|b tech|btech|bca|b sc/.test(q))s.program='SCSET UG';
 const base={question,scope:s,retrieved:rank,status:'not_found',selected:[],reason:'No sufficiently specific evidence was found.',next:'Use the relevant official notice or ask the responsible university office.'};
 const finish=(status,reason,next,selected=[])=>({...base,status,reason,next,selected});
 if(/ignore (all |previous |the )?(instructions|rules)|system prompt|reveal instructions|pretend (the )?(policy|rule)|invent (a |the )?(rule|policy)|override (the )?(rules|evidence)/.test(q))return finish('refused','This request attempts to override the evidence rules.','Ask a campus policy question supported by official evidence.');
 if(/(another|other|someone|classmate|roommate).*(marks|record|address|phone|attendance)|marks of|student record|private.*(phone|address|record)/.test(q))return finish('refused','Private student records are outside this assistant’s permitted scope.','Use the university’s authorised process for your own records.');
 const certain=rank.filter(f=>f.alias_match);
 if(!certain.length){
  if(/fee|refund/.test(q))return finish(s.program&&s.year?'not_found':'clarify',s.program&&s.year?'The monetary rules are not in this evidence set.':'A fee or refund amount depends on scope.','Specify programme, admission year and fee category; use the applicable official policy.');
  if(/exam.*(date|when)|when.*exam|endsem/.test(q))return finish('clarify','An examination date needs the academic year, semester and examination type.','Specify those details; a course-specific date also needs the official date sheet.');
  if(/class.*(start|begin|commenc)|when.*classes/.test(q))return finish('clarify','Class commencement differs by student group and semester.','Choose freshman, returning or even-semester classes and the academic year.');
  return base;
 }
 let selected=certain;
 if(selected.some(f=>f.source_id==='S4')){
  if(!s.year)return finish('clarify','The calendar answer depends on academic year.','Select academic year 2026-27 or include a year in the question.');
  selected=selected.filter(f=>!f.year||f.year===s.year);
  if(!selected.length)return finish('not_found','No matching academic-year evidence is available.','The calendar in this build covers AY 2026-27 only.');
 }
 if(selected.some(f=>f.topic==='odd_exam')&&!s.semester)return finish('clarify','The examination window depends on semester.','Specify odd or even semester; this evidence contains the odd-semester window.');
 selected=selected.filter(f=>!f.semester||!s.semester||f.semester===s.semester);
 if(!selected.length)return finish('not_found','No matching semester evidence is available.','Check the calendar for the requested semester.');
 if(selected.some(f=>f.program)){
  if(!s.program)return finish('clarify','These academic rules apply to SCSET undergraduate programmes.','Specify your programme or select SCSET UG.');
  selected=selected.filter(f=>!f.program||f.program===s.program);
  if(!selected.length)return finish('not_found','The available rule is for a different programme.','Use the academic rules for your school and programme.');
 }
 if(/(my|course|subject|specific).*exam|exam.*(my|course|subject|specific)/.test(q)&&selected.some(f=>f.topic==='odd_exam'))return finish('not_found','A university-wide examination window is not a course date sheet.','Consult the official course examination timetable.');
 if(/condon/.test(q)&&/eligible|eligibility|can i|am i|guarantee/.test(q))return finish('not_found','The calendar provides a deadline, not a personal condonation eligibility rule.','Ask your school or examination office about eligibility.');
 if(/latest|current|today|2026/.test(q)&&selected.every(f=>corpus.sources.find(x=>x.id===f.source_id)?.historical))return finish('not_found','Only historical evidence is available for this question.','Check later amendments with the responsible office before relying on a current rule.');
 const top=selected[0];selected=selected.filter(f=>f.topic===top.topic);
 let conflict=selected.some(f=>f.claim_key&&selected.some(g=>g.id!==f.id&&g.claim_key===f.claim_key&&g.value!==f.value&&g.year===f.year&&g.program===f.program));
 if(conflict)return finish('conflict','Matching-scope evidence contains incompatible claims without verified supersession.','Confirm the governing notice and applicable cohort with the university.');
 return finish('answered','Supported by the selected evidence cards.','Confirm later amendments before a consequential decision.',selected.slice(0,3));
}
function render(result,corpus){
 const citations=result.selected.map(f=>({fact_id:f.id,source_id:f.source_id,section:f.section,quote:f.quote,...corpus.sources.find(s=>s.id===f.source_id)}));
 return {...result,answer:result.status==='answered'?result.selected.map(f=>f.text).join(' '):result.reason,citations,caution:citations.some(c=>c.historical)?'Historical source: current applicability and later amendments need confirmation.':citations.length?'Calendar and policy notices may be amended. Check the latest applicable notice.':'',confidence:'No numerical confidence score is inferred.',mode:'Deterministic evidence workflow'};
}
function assemble(question,scope,version,corpus,prompts){
 const r=resolve(question,scope,corpus);let evidence=r.retrieved.map(f=>({id:f.id,source_id:f.source_id,text:f.text,section:f.section,source_scope:corpus.sources.find(s=>s.id===f.source_id)?.scope,year:f.year,program:f.program}));
 const prompt=prompts.find(p=>p.id===version)||prompts[3];
 if(['V4','V5'].includes(version))evidence=evidence.filter(f=>r.selected.some(x=>x.id===f.id));
 return {system:prompt.text,user:JSON.stringify({...['V4','V5'].includes(version)?{APPLICATION_GATE:{status:r.status,allowed_fact_ids:r.selected.map(f=>f.id)}}:{},QUESTION:question,SCOPE:r.scope,EVIDENCE:evidence,OUTPUT_SCHEMA:version==='V5'?{type:'object',additionalProperties:false,required:['status','fact_ids'],properties:{status:{enum:STATES},fact_ids:{type:'array',items:{type:'string'},maxItems:3}}}:{status:STATES,fact_ids:['IDs from EVIDENCE only']}},null,2),decision:r};
}
function validate(draft,decision,corpus){
 let issues=[];let d;
 try{d=typeof draft==='string'?JSON.parse(draft):draft;}catch{return {pass:false,issues:['Output is not valid JSON.']};}
 if(!d||Array.isArray(d)||typeof d!=='object')return {pass:false,issues:['Expected a JSON object.']};
 if(Object.keys(d).sort().join(',')!=='fact_ids,status')issues.push('Only status and fact_ids are allowed.');
 if(!STATES.includes(d.status))issues.push('Invalid status.');
 if(!Array.isArray(d.fact_ids)||d.fact_ids.length>3||d.fact_ids.some(x=>typeof x!=='string'))issues.push('fact_ids must contain at most three strings.');
 const ids=Array.isArray(d.fact_ids)?d.fact_ids:[];
 if(new Set(ids).size!==ids.length)issues.push('Duplicate fact IDs are not allowed.');
 if(ids.some(id=>!decision.retrieved.some(f=>f.id===id)))issues.push('A selected fact is absent from the retrieved context.');
 if(d.status!==decision.status)issues.push('Model status does not match the application’s evidence/scope gate.');
 if(d.status==='answered'&&!ids.length)issues.push('An answer requires at least one approved fact.');
 if(d.status!=='answered'&&ids.length)issues.push('Non-answer statuses must not select facts.');
 if(ids.some(id=>!decision.selected.some(f=>f.id===id)))issues.push('Selected fact fails the application’s relevance/scope gate.');
 const pass=issues.length===0;
 return {pass,issues,checked:['JSON contract','fact membership','scope/status policy','approved wording'],semantic_note:'Checks establish consistency with curated cards and application policy; source interpretation and corpus coverage still need human review.',result:pass?render({...decision,selected:ids.map(id=>corpus.facts.find(f=>f.id===id))},corpus):null};
}
const api={norm,retrieve,resolve,render,assemble,validate,STATES};if(typeof module!=='undefined')module.exports=api;root.CampusEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
