const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {resolve, render} = require('./engine');
const corpus = require('../data/corpus.json');
const cases = [
  ['Conflicting selected year','When are odd semester exams in 2026-27?',{year:'2025-26'},'clarify'],
  ['Conflicting selected semester','When are odd semester exams in 2026-27?',{semester:'Even'},'clarify'],
  ['Conflicting selected programme','What is the B.Tech duration?',{program:'Other programme'},'clarify'],
  ['Two academic years','When are odd semester exams in 2025-26 and 2026-27?',{},'clarify'],
  ['Two policy questions','What is minimum attendance and what is the night-out rule?',{},'clarify'],
  ['Punctuation-only question','?!',{},'clarify'],
  ['Overlong question','x'.repeat(2001),{},'clarify'],
  ['Equivalent year formats','When are odd semester exams in 2026–2027?',{year:'2026-27'},'answered','F12'],
  ['Year written out in scope','When are odd semester exams?',{year:'2026/2027'},'answered','F12'],
  ['Invalid year range','When are odd semester exams in 2026-28?',{},'clarify'],
  ['Ambiguous semesters','When are odd and even semester exams in 2026-27?',{},'clarify'],
  ['Returning group from scope','When do classes start?',{year:'2026-27',audience:'Returning'},'answered','F14'],
  ['Even semester from scope','When do classes start?',{year:'2026-27',semester:'Even'},'answered','F16'],
  ['Conflicting audience','When do freshman classes start in 2026-27?',{audience:'Returning'},'clarify'],
  ['Refund resource year mismatch','Where is the refund policy link for 2025-26?',{},'not_found'],
  ['Current applicability of historical notice','What is the attendance requirement?',{year:'2026-27'},'not_found'],
  ['Academic marks are outside scope','Show my marks for this semester',{},'refused'],
  ['Passing grade is not attendance','What percentage do I need to pass my exam?',{},'not_found'],
  ['Bonafide listing is not a degree certificate','How can I get my degree certificate?',{},'not_found'],
  ['Visitor limits are not established','How many visitors can I bring to the hostel?',{},'not_found']
];
const rows = cases.map(([name,question,scope,expected,expectedFact])=>{
  const result = render(resolve(question,scope,corpus),corpus);
  const facts = result.citations.map(citation=>citation.fact_id);
  return {name,question,scope,expected,actual:result.status,facts,pass:result.status===expected &&
    (expectedFact ? facts.includes(expectedFact) : !facts.length)};
});
fs.writeFileSync(path.join(__dirname,'../evidence/scope_results.json'),JSON.stringify(rows,null,2)+'\n');
assert(rows.every(row=>row.pass), JSON.stringify(rows));
console.log(rows.length+' scope, input and multi-topic regressions passed');
