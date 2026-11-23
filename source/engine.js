/* Shared evidence engine for the browser, Node.js and the hosted Worker. */
(function expose(root) {
  'use strict';

  const STATES = ['answered', 'clarify', 'not_found', 'conflict', 'refused'];
  const MAX_QUESTION = 2000;
  const SCOPE_VALUES = {
    program: ['SCSET UG', 'Other programme'],
    semester: ['Odd', 'Even'],
    audience: ['Freshman', 'Returning'],
  };
  const STOPWORDS = new Set([
    'what', 'when', 'where', 'how', 'the', 'for', 'are', 'can', 'and', 'with',
    'about', 'does', 'university', 'bennett', 'please', 'tell', 'have', 'this',
    'that', 'will', 'from',
  ]);

  const norm = value => String(value).toLowerCase().normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N}%]+/gu, ' ').trim();
  const words = value => norm(value).split(/\s+/).filter(word => word.length > 2 && !STOPWORDS.has(word));

  function academicYear(value) {
    const match = /^(20\d{2})\s*[-–—/]\s*(20\d{2}|\d{2})$/.exec(value.trim());
    if (!match) return null;
    const start = Number(match[1]);
    const end = match[2].length === 2 ? Math.floor(start / 100) * 100 + Number(match[2]) : Number(match[2]);
    if (end !== start + 1 && !(match[2] === '00' && start % 100 === 99)) return null;
    return match[1] + '-' + match[2].slice(-2);
  }

  function normalizeScope(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { scope: {}, issues: ['Scope must be an object.'] };
    }
    const scope = {};
    const issues = [];
    for (const [key, entry] of Object.entries(value)) {
      if (key !== 'year' && !Object.hasOwn(SCOPE_VALUES, key)) {
        issues.push('Scope allows programme, academic year, semester and audience.');
        continue;
      }
      if (typeof entry !== 'string') {
        issues.push('Scope values must be text.');
        continue;
      }
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const canonical = key === 'year' ? academicYear(trimmed)
        : SCOPE_VALUES[key].find(option => option.toLowerCase() === trimmed.toLowerCase());
      if (canonical) scope[key] = canonical;
      else issues.push('Choose a valid ' + ({program: 'programme', year: 'academic year'}[key] || key) + '.');
    }
    return { scope, issues };
  }

  function rankFacts(question, corpus) {
    const query = ' ' + norm(question) + ' ';
    const terms = new Set(words(question));
    const documents = corpus.facts.map(fact => words([fact.topic, fact.text, ...fact.aliases].join(' ')));
    const count = documents.length;
    const averageLength = documents.reduce((sum, doc) => sum + doc.length, 0) / count || 1;
    const weights = new Map([...terms].map(term => {
      const frequency = documents.filter(doc => doc.includes(term)).length;
      return [term, Math.log(1 + (count - frequency + 0.5) / (frequency + 0.5))];
    }));
    return corpus.facts.map((fact, index) => {
      const doc = documents[index];
      let score = 0;
      for (const [term, weight] of weights) {
        const frequency = doc.filter(word => word === term).length;
        score += weight * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * doc.length / averageLength));
      }
      const alias = fact.aliases.filter(value => query.includes(' ' + norm(value) + ' '))
        .sort((a, b) => b.length - a.length)[0];
      if (alias) score += 8 + norm(alias).split(' ').length;
      return { ...fact, score: Number(score.toFixed(3)), alias_match: alias || null };
    }).filter(fact => fact.score > 0)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  }

  function retrieve(question, corpus, limit = 4) {
    return rankFacts(String(question ?? '').slice(0, MAX_QUESTION), corpus).slice(0, limit);
  }

  function questionScope(question, normalized) {
    const rawYears = [...question.matchAll(/\b20\d{2}\s*[-–—/]\s*(?:20\d{2}|\d{2})\b/g)]
      .map(match => academicYear(match[0]));
    const q = norm(question);
    const academicContext = /\b(exams?|examinations?|semesters?|classes|condonation|endsem)\b/.test(q);
    const semesters = ['Odd', 'Even'].filter(term => {
      const word = term.toLowerCase();
      const pattern = '\\b' + word + ' (?:semesters?|sem|endsem|exams?|classes|term)\\b|\\b(?:semesters?|sem|endsem|exams?) ' + word + '\\b';
      return new RegExp(pattern).test(q);
    });
    const pairedSemesters = /\b(odd (?:and )?even|even (?:and )?odd)\b/.test(q);
    if (academicContext && pairedSemesters) semesters.splice(0, semesters.length, 'Odd', 'Even');
    if (academicContext && !semesters.length) {
      if (/\bdecember\b/.test(q)) semesters.push('Odd');
      if (/\b(january|spring classes)\b/.test(q)) semesters.push('Even');
    }
    const audiences = [];
    if (/\b(freshm[ae]n|freshers?|first year|new students?)\b/.test(q)) audiences.push('Freshman');
    if (/\b(returning|seniors?)\b/.test(q)) audiences.push('Returning');
    const program = /\b(scset|b tech|btech|bca|b sc)\b/.test(q) ? ['SCSET UG'] : [];
    const values = { year: rawYears.filter(Boolean), semester: semesters, audience: audiences, program };
    const scope = { ...normalized };
    const conflicts = [];
    for (const [key, candidates] of Object.entries(values)) {
      const distinct = [...new Set(candidates)];
      if (distinct.length > 1 || (distinct.length && scope[key] && scope[key] !== distinct[0])) {
        conflicts.push(({program: 'programme', year: 'academic year'})[key] || key);
      } else if (distinct.length) {
        scope[key] = distinct[0];
      }
    }
    return { scope, conflicts, invalidYear: rawYears.includes(null) };
  }

  function isSupportedIntent(fact, q) {
    if (!fact.alias_match) return false;
    if (fact.topic === 'attendance' && !/\b(attendance|attend|hazri)\b/.test(q)) {
      return /\b(exam eligibility|sit for (?:the )?finals|present in class)\b/.test(q);
    }
    if (fact.topic === 'certificate') {
      return !/\b(degree|transfer|migration|provisional|diploma|internship|character|experience|medical) certificates?\b/.test(q);
    }
    if (fact.topic === 'registration' && fact.alias_match === 'course credit') {
      return /\b(registration|registered|enrol|enroll)\b/.test(q);
    }
    if (fact.topic === 'hostel_visitors') {
      return !/\b(maximum number|how many guests|how many visitors|visiting hours|visiting time|visitor timings)\b/.test(q);
    }
    return true;
  }

  function resolve(question, rawScope = {}, corpus) {
    const input = typeof question === 'string' ? question : '';
    const normalized = normalizeScope(rawScope);
    const base = {
      question: input,
      scope: normalized.scope,
      retrieved: [],
      selected: [],
      status: 'not_found',
      reason: 'The source library has no matching evidence for this question.',
      next: 'Check the official notices or ask the university office responsible for this topic.',
    };
    const finish = (status, reason, next, selected = []) => ({ ...base, status, reason, next, selected });
    const clarify = (reason, next) => finish('clarify', reason, next);
    const missing = (reason, next) => finish('not_found', reason, next);
    if (input.length > MAX_QUESTION) {
      return clarify('This question is over 2,000 characters.', 'Shorten it to one campus policy question.');
    }
    const q = norm(input);
    if (!q) return clarify('Enter a campus policy question.', 'Ask about attendance, hostel rules, academic dates or documents.');

    if (/ignore (all |previous |the )?(instructions|rules)|system prompt|reveal instructions|pretend (the )?(policy|rule)|invent (a |the )?(rule|policy)|override (the )?(rules|evidence)/.test(q)) {
      return finish('refused', 'CampusCompass uses the official evidence in its library.', 'Ask a campus policy question.');
    }
    const otherRecord = /\b(another|other|someone|classmate|roommate)\b.*\b(marks|record|address|phone|attendance)\b|\bmarks of\b|\bprivate\b.*\b(phone|address|record)\b/;
    const ownRecord = /\b(my|student) (?:marks|grades|record|phone number)\b|\b(show|give|check|fetch|get|what is|what s) my (?:current )?attendance(?: percentage| record)?(?:$| (?:this|for|so far)\b)/;
    if (otherRecord.test(q) || ownRecord.test(q)) {
      return finish('refused', 'Private student records require the university’s authorised process.', 'Use the student portal or contact the university for your own records.');
    }

    if (normalized.issues.length) return clarify(normalized.issues.join(' '), 'Update the scope and try again.');
    const stated = questionScope(input, normalized.scope);
    base.scope = stated.scope;
    if (stated.invalidYear) return clarify('Use one valid academic-year range.', 'For example, enter 2026-27.');
    if (stated.conflicts.length) {
      return clarify('The question and scope specify different values for ' + stated.conflicts.join(', ') + '.',
        'Use one consistent value per field in the question and the scope controls.');
    }

    const ranked = rankFacts(input, corpus);
    base.retrieved = ranked.slice(0, 4);
    const scope = base.scope;
    const classStart = /\bclasses\b/.test(q) && /\b(start|begin|resume|commence|commencement|starting|resuming)\b/.test(q);
    let candidates = ranked.filter(fact => isSupportedIntent(fact, q));
    if (classStart && !candidates.some(fact => fact.topic.endsWith('_classes'))) {
      const topic = scope.semester === 'Even' ? 'even_classes'
        : { Freshman: 'freshman_classes', Returning: 'returning_classes' }[scope.audience];
      if (topic) candidates.push(...corpus.facts.filter(fact => fact.topic === topic));
    }
    const topicSet = new Set(candidates.map(fact => fact.topic));
    if (topicSet.size > 1 && (/\b(and|also|plus)\b/.test(q) || (input.match(/\?/g) || []).length > 1)) {
      return clarify('This question covers more than one campus policy.', 'Ask about one topic at a time to get the applicable sources.');
    }
    if (!candidates.length) {
      if (/\b(fees?|refunds?)\b/.test(q)) {
        return scope.program && scope.year
          ? missing('The source library does not include fee amounts or refund eligibility.', 'Use the applicable official fee or refund policy.')
          : clarify('Fees and refunds depend on programme, admission year and fee category.', 'Enter the programme and year and identify the fee category.');
      }
      if (/\b(exams?|examinations?|endsem)\b/.test(q) && /\b(date|dates|when|schedule|window|endsem)\b/.test(q)) {
        if (scope.year && scope.semester) {
          return missing('The source library does not have a matching exam window.', 'Use the academic calendar or the official course timetable.');
        }
        return clarify('An examination date depends on year, semester and exam type.', 'Add the academic year, semester and examination type.');
      }
      if (classStart || /\bwhen.*\bclasses\b/.test(q)) {
        return clarify('Class commencement depends on year, semester and student group.', 'Choose freshman, returning or even-semester classes and include the academic year.');
      }
      return base;
    }

    if (/\bcondon/.test(q)) candidates.sort((a, b) => Number(b.topic === 'condonation') - Number(a.topic === 'condonation'));
    let selected = candidates.filter(fact => fact.topic === candidates[0].topic);
    const topic = selected[0].topic;
    if (topic === 'odd_exam' && /\b(my|course|subject|specific)\b.*\b(exam|exams|examination)\b|\b(exam|exams|examination)\b.*\b(course|subject)\b/.test(q)) {
      return missing('The calendar gives a university-wide examination window.', 'Consult the official course examination timetable for an individual exam date.');
    }
    if (selected.some(fact => fact.source_id === 'S4') && !scope.year) {
      return clarify('The calendar answer depends on academic year.', 'Select 2026-27 or include an academic year in the question.');
    }
    if (topic === 'odd_exam' && !scope.semester) {
      return clarify('The examination window depends on semester.', 'Specify the odd or even semester.');
    }
    if (selected.some(fact => fact.program) && !scope.program) {
      return clarify('This academic rule depends on your programme.', 'Select SCSET UG or specify your programme.');
    }
    const scopeFields = ['year', 'semester', 'program', 'audience'];
    const matched = selected.filter(fact => scopeFields.every(key => !fact[key] || !scope[key] || fact[key] === scope[key]));
    if (!matched.length) {
      return missing('The available evidence covers a different scope.', 'Check the official notice for the academic year, semester, programme or student group you specified.');
    }
    selected = matched;

    if (topic === 'condonation' && /\b(eligible|eligibility|can i|am i|guarantee|do i qualify)\b/.test(q)) {
      return missing('The calendar contains the application deadline. Personal eligibility is outside its scope.', 'Ask your school or examination office about eligibility.');
    }
    const asksCurrent = /\b(latest|current|today|this (?:year|semester)|as of|still applicable)\b/.test(q);
    const sources = new Map(corpus.sources.map(source => [source.id, source]));
    if ((asksCurrent || scope.year) && selected.every(fact => sources.get(fact.source_id)?.historical)) {
      return missing('The source library only has historical evidence for this rule.', 'Check the current notice or ask the responsible university office.');
    }
    const disagrees = selected.some(fact => fact.claim_key && selected.some(other =>
      other.id !== fact.id && fact.claim_key === other.claim_key && fact.value !== other.value
      && scopeFields.every(key => fact[key] === other[key])));
    if (disagrees) {
      return finish('conflict', 'Matching evidence contains different claims.', 'Confirm which notice applies with the university.');
    }

    selected = selected.slice(0, 3);
    const supported = selected.map(fact => ranked.find(item => item.id === fact.id) || fact);
    const approved = new Set(supported.map(fact => fact.id));
    const shortlist = ranked.slice(0, 4);
    const missingFacts = supported.filter(fact => !shortlist.some(item => item.id === fact.id));
    if (missingFacts.length) {
      const present = shortlist.filter(fact => approved.has(fact.id));
      const other = shortlist.filter(fact => !approved.has(fact.id));
      base.retrieved = [...present, ...missingFacts, ...other].slice(0, 4);
    }
    return finish('answered', 'Supported by the cited evidence.', 'Use the cited notice to confirm applicability.', selected);
  }

  function render(result, corpus) {
    const sources = new Map(corpus.sources.map(source => [source.id, source]));
    const citations = result.selected.map(fact => ({
      ...sources.get(fact.source_id),
      fact_id: fact.id,
      source_id: fact.source_id,
      section: fact.section,
      quote: fact.quote,
    }));
    const historical = citations.some(citation => citation.historical);
    return {
      ...result,
      answer: result.status === 'answered' ? result.selected.map(fact => fact.text).join(' ') : result.reason,
      citations,
      caution: historical
        ? 'Historical source. Check current applicability with the university.'
        : citations.length && result.selected.some(fact => fact.source_id === 'S4')
          ? 'Academic calendars can change. Check the latest notice before making plans.'
          : '',
      confidence: 'No numerical confidence score is inferred.',
      mode: 'Deterministic evidence workflow',
    };
  }

  function assemble(question, scope, version, corpus, prompts) {
    const decision = resolve(question, scope, corpus);
    const prompt = prompts.find(item => item.id === version) || prompts.find(item => item.id === 'V5');
    const gated = ['V4', 'V5'].includes(prompt.id);
    const factIds = decision.selected.map(fact => fact.id);
    const evidence = decision.retrieved.filter(fact => !gated || factIds.includes(fact.id)).map(fact => ({
      id: fact.id,
      source_id: fact.source_id,
      text: fact.text,
      section: fact.section,
      source_scope: corpus.sources.find(source => source.id === fact.source_id)?.scope,
      year: fact.year,
      program: fact.program,
    }));
    const schema = prompt.id === 'V5' ? {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'fact_ids'],
      properties: {
        status: { enum: STATES },
        fact_ids: { type: 'array', items: { type: 'string' }, maxItems: 3 },
      },
    } : { status: STATES, fact_ids: ['IDs from EVIDENCE only'] };
    return {
      system: prompt.text,
      user: JSON.stringify({
        ...(gated ? { APPLICATION_GATE: { status: decision.status, allowed_fact_ids: factIds } } : {}),
        QUESTION: question,
        SCOPE: decision.scope,
        EVIDENCE: evidence,
        OUTPUT_SCHEMA: schema,
      }, null, 2),
      decision,
    };
  }

  function validate(draft, decision, corpus) {
    let parsed;
    try {
      parsed = typeof draft === 'string' ? JSON.parse(draft) : draft;
    } catch {
      return { pass: false, issues: ['Output is not valid JSON.'] };
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return { pass: false, issues: ['Expected a JSON object.'] };
    }
    const issues = [];
    if (Object.keys(parsed).sort().join(',') !== 'fact_ids,status') issues.push('Only status and fact_ids are allowed.');
    if (!STATES.includes(parsed.status)) issues.push('Invalid status.');
    const ids = Array.isArray(parsed.fact_ids) ? parsed.fact_ids : [];
    if (!Array.isArray(parsed.fact_ids) || ids.length > 3 || ids.some(id => typeof id !== 'string')) {
      issues.push('fact_ids must contain at most three strings.');
    }
    if (new Set(ids).size !== ids.length) issues.push('Duplicate fact IDs are not allowed.');
    if (ids.some(id => !decision.retrieved.some(fact => fact.id === id))) {
      issues.push('A selected fact is absent from the retrieved context.');
    }
    if (parsed.status !== decision.status) issues.push('Model status disagrees with the evidence decision.');
    if (parsed.status === 'answered' && !ids.length) issues.push('An answer requires at least one approved fact.');
    if (parsed.status !== 'answered' && ids.length) issues.push('A non-answer cannot select facts.');
    if (ids.some(id => !decision.selected.some(fact => fact.id === id))) {
      issues.push('Selected fact is outside the application’s topic or scope.');
    }
    return {
      pass: issues.length === 0,
      issues,
      checked: ['JSON contract', 'fact membership', 'scope/status policy', 'approved wording'],
      semantic_note: 'The contract checks the selection against the curated evidence and application decision.',
      result: issues.length ? null : render({
        ...decision, selected: ids.map(id => corpus.facts.find(fact => fact.id === id)),
      }, corpus),
    };
  }

  const engine = { norm, retrieve, normalizeScope, resolve, render, assemble, validate, STATES, MAX_QUESTION };
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.CampusEngine = engine;
})(globalThis);
