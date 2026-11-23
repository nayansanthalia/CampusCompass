# CampusCompass changelog

## 2.0 engineering release

- Rebuilt the helpdesk, cited answer view, searchable evidence library, Prompt Studio and evaluation workspace for desktop and mobile.
- Added programme, academic year, semester and student-group matching, including conflicting selections and mismatched refund-policy years.
- Added a shared JSON API for source discovery, answers, draft validation and optional local inference. The Node.js server and hosted Worker use the same evidence engine.
- Replaced the request-by-request process bridge with a persistent optional GGUF worker and bounded inference requests.
- Added checks for scope, source applicability, malformed requests, answer parity, model adapter failures and the hosted runtime.
- Kept the Milestone 3 model outputs and evaluation snapshot with their original run settings.

## Milestone development record · 17 November 2026

This records work performed with ChatGPT assistance in this session. It is not a historical team-contribution log.

1. Audited Milestone 2 requirements and the earlier small prototype.
2. Expanded to five official sources and 19 curated facts, with issue dates, applicability notes and short quotes.
3. Replaced substring-only matching with BM25-style ranking plus explicit alias gates. Added source-year, programme and semester handling.
4. Built the portable helpdesk, source ledger, Prompt Studio and browser test bench.
5. Executed 32 Qwen completions across V0-V3 on eight saved questions. Retained invalid-format and irrelevant-selection failures.
6. Added V4 application-gate metadata and reduced context. Executed eight completions; correct statuses still included two copied-placeholder failures.
7. Changed only OUTPUT_SCHEMA representation for V5. Executed eight more completions; all eight final contracts accepted in this development rerun.
8. Verified the browser answer, clarification, valid-draft acceptance and forged-fact rejection flows.
9. Added and checked the optional local inference API bridge. Its fresh output is retained separately from the 48 comparative completions.
10. Created the technical report, charts, architecture, demo/viva guide and narrated progress video.

## Known misses retained
H01, H03 and H08 are false abstentions caused by alias gating despite a relevant fact appearing in the top four retrieved cards. These three authored challenge cases are documented rather than removed or portrayed as successes.

## Next evidence to collect
Independent paraphrases; wider official source coverage; amendment/applicability review; larger-model comparison; repeated-run consistency; human claim-relevance ratings; actual team review and contribution evidence.

## Milestone 3 review
- Ask for clarification when question text conflicts with selected scope, or when multiple recognized policies are combined.
- Normalize short and full academic-year ranges before comparing.
- Rescore the recorded Qwen outputs against the archived experimental engine and corpus.
- Retain six focused regression cases with expected and actual outcomes.
