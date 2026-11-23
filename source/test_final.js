const fs = require('node:fs');
const path = require('node:path');
const engine = require('./engine');
const root = path.join(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const corpus = read('data/corpus.json');
const rows = read('data/final_cases.json').map(([id, question, scope, expected, expectedFact]) => {
  const decision = engine.resolve(question, typeof scope === 'string' ? (scope ? {program:scope} : {}) : scope, corpus);
  const output = engine.render(decision, corpus);
  const facts = output.citations.map(citation => citation.fact_id);
  return {id, question, scope, expected, expectedFact, actual:output.status, answer:output.answer, facts,
    pass: output.status === expected && (expectedFact ? facts.includes(expectedFact) : !facts.length)};
});
fs.writeFileSync(path.join(root, 'evidence/final_cases.json'), JSON.stringify(rows, null, 2) + '\n');
console.log(rows.map(r => [r.id,r.expected,r.actual,r.facts,r.pass].join(' ')).join('\n'));

if (rows.some(row => !row.pass)) process.exitCode = 1;
