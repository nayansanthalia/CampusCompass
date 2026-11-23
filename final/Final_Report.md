# CampusCompass
## Source-grounded campus helpdesk | Final project report
TEAM AETHERMIND · PE-B37-13 · SCSE4041 · Bennett University
Rishi Mulchandani (lead), Nayan Santhalia, Poshkar Garg, Aditya Kumar, Bhavishya Jakhar
Milestone 3 · 18 November 2026

## Executive summary
CampusCompass answers a limited set of campus-policy questions with inspectable evidence and refers students to the university when a decision requires staff. We compared six prompt versions using 48 recorded local Qwen completions. V5 passed the output contract for eight development cases. Final routing matched all 42 existing statuses after targeted alias changes, up from 39. Twelve additional, internally authored checks passed the expected status and citation criterion. These small tests expose prototype behavior within a curated corpus. No student pilot or university endorsement was obtained.

## 1. Introduction
Students looking for regulations must identify the applicable source, programme and year. CampusCompass addresses C1, Campus Helpdesk Assistant. It accepts a natural-language question and optional scope fields and returns a supported answer, clarification, evidence gap, conflict or privacy refusal. Its goal is to make the path from a question to an official source easy to inspect.

## 2. Problem and domain analysis
Primary users are students, including incoming students unfamiliar with campus offices. Staff are the authority for exceptions, individual records and ticket resolution. The Registrar website publishes notices and forms, and Bennett operates a separate official service desk. The prototype covers 19 curated facts across five original sources. Historical documents can explain what a notice said, while current rules, monetary amounts and personal eligibility may require staff verification. Source title, locator, short excerpt, applicability and date are retained.

## 3. Existing solutions and literature
The following comparison uses official documentation and repository descriptions. No competitor was run on the CampusCompass dataset, so the comparison concerns design rather than relative accuracy.

Bennett Service Desk [1] and Registrar resources [2]. These are the actual institutional channels. The Registrar circular directs relevant student queries to the official helpdesk [3]. CampusCompass adds a triage link to that channel when the result needs action or verification. It neither creates tickets nor sees student records.

AI University RAG [4]. Its repository describes ingesting university PDFs and answering with page-level citations. This supports broader coverage than nineteen manually reviewed facts. The tradeoff is that PDF extraction and page-to-chunk mapping require validation. CampusCompass retains exact source locators on each approved fact and does not automate ingestion.

University Chatbot [5]. The project documents keyword and dense retrieval, reranking, authority signals and a human review queue. This design can handle more varied phrasing and allow staff to correct low-confidence answers. CampusCompass uses lexical ranking followed by conservative phrase matching, which is inspectable offline. Our three false abstentions demonstrate the cost of that gate. We repaired targeted phrases and retained the old failures for comparison. Staff review is a handoff, not a persisted review queue.

University Chatbot and Assistant [6]. Its documentation describes page-aware extraction, persistent retrieval and replacement of old chunks during updates. This motivates a distinction between cleaning up an index and verifying whether a new notice actually supersedes an older policy for a particular cohort. CampusCompass records scope and flags incompatible matching-scope facts using synthetic fixtures. It does not continuously monitor amendments.

Rulebook AI [7]. It already distinguishes answers, uncovered questions and rule conflicts. These behaviors therefore cannot support a first-of-kind claim. CampusCompass adds programme and calendar clarification within the Bennett setting and makes the exact prompts, model drafts and contract checks inspectable.

RAG [8] grounds generation in retrieved material. ALCE [9] evaluates correctness and citation quality separately. We distinguish retrieval hits, routing status, selected fact IDs and model contract acceptance. A valid ID establishes membership in the approved set. It does not independently prove that a human interpreted the source correctly.

## 4. Prompt and solution design
Question and scope → lexical top four → phrase and applicability checks → permitted facts/status → Qwen JSON draft in Prompt Studio → validate status and IDs → render curated wording with citation. The standalone helpdesk directly renders the deterministic decision. Optional local inference and recorded replay run through Prompt Studio. The final prompt payload separates QUESTION, SCOPE, EVIDENCE, APPLICATION_GATE and OUTPUT_SCHEMA. Only status and fact_ids are allowed in the draft. Drafts with invented IDs, unsupported topics, duplicates or extra fields fail validation.

## 5. Prompt development and implementation
V0 is the conversational baseline. V1 adds grounded evidence instructions. V2 adds answer/refusal structure. V3 requires machine-readable status and fact IDs. V4 supplies the trusted gate and reduces the evidence to eligible facts. V5 changes the output schema representation to typed JSON Schema while retaining the V4 system prompt. Full wording and actual inputs are archived with the project. The V4 intervention changes both context and gate, so their effects cannot be separated. The V5 comparison has the same eight cases and changed schema representation only.
Qwen2.5-0.5B-Instruct Q4_K_M, llama-cpp-python 0.3.36, four CPU threads, temperature 0, seed 42 and no forced JSON grammar. The browser build works offline for curated answers and recorded evidence. For M3 we updated the alias table and added the official support link. No prompt change or new live inference is claimed.

Final review hardened scope handling. If question text and form controls disagree, the app asks for clarification instead of silently overriding the form. Equivalent academic year formats are normalized before comparison. Recognized compound policy questions can prompt a request to split them.

## 6. Evaluation and testing
A routing pass means the expected status matches. A retrieval hit means the expected card is present in top four. The additional checks require the expected status and expected citation for answerable questions, and no cited fact for non-answers. Contract fixtures check rejected as well as accepted model drafts. Conflicts are tested with synthetic contradictions only. The project provides raw responses, question-level results, model manifests and rerun commands.

## 7. Results and discussion
M2 → M3 status agreement on the same cases: 39/42 → 42/42. The original challenge set improves 9/12 → 12/12 and is now a regression set because the misses guided changes. F07, F04 and F17 were already retrieved in H01, H03 and H08. Routing blocked them because no alias matched. The final results retain 27/27 top-four hits, 10/10 validator fixtures and 2/2 synthetic policy checks. The additional authored checks passed 12/12. Several deliberately resemble the repaired phrases, so the set cannot establish independent generalization.
V0 through V2 produced no valid JSON on the eight cases. V3 produced eight valid JSON drafts and one accepted contract. V4 accepted six, with two placeholder errors. V5 accepted all eight development contracts. These are contract results, and cannot be read as accuracy estimates. A novel paraphrase without an approved trigger may still abstain.

Eight focused regression checks passed. They cover mismatched year, semester and programme, multiple years, compound questions, equivalent year formats, punctuation-only input and overlong questions. The release check reruns these cases, the 42 routing cases and 12 additional cases. It recompiles the standalone app and checks that its embedded scripts parse and that the hosted and offline copies match. See evidence/scope_results.json. Recorded model scores are reproduced against the archived experimental engine and corpus.

## 8. Responsible AI and project contribution
Do not enter enrollment details, grades, addresses or private records. The offline version requires no account and uses a locally embedded corpus. The optional server is intended for local use. Short quotations and links support review. Dates and scope discourage applying older notices to the wrong cohort. Known gaps include limited language coverage, missing documents, article amendment verification and reliance on manually curated wording. Real staff make case-specific decisions. ChatGPT assisted with research, coding, tests and documentation. The team should verify artifacts, record actual work and explain the decisions during viva.

## 9. Conclusion and future scope
CampusCompass demonstrates a Bennett-specific evidence workflow with reproducible prompt experiments and explicit abstentions. A future study should freeze the corpus, recruit independent evaluators, collect anonymized queries, annotate claim-level source support and report false answers separately from false refusals. Staff should verify source applicability before institutional use.

## References
[1] Bennett Service Desk https://helpdesk.bennett.edu.in/index.php
[2] Registrar resources https://www.bennett.edu.in/notices-registrar-office/
[3] Registrar circular https://www.bennett.edu.in/wp-content/uploads/2024/10/Circular-regarding-student-quries-online.pdf
[4] AI University RAG https://github.com/Ashmeen-Kaur/ai-university-rag
[5] University Chatbot https://github.com/TheWerbinator/university-chatbot
[6] University Chatbot and Assistant https://github.com/shv2312/University-Chatbot-and-Assistant
[7] Rulebook AI https://github.com/Mayankpawar28/rulebook-ai
[8] Lewis et al., Retrieval-Augmented Generation https://arxiv.org/abs/2005.11401
[9] Gao et al., Enabling Large Language Models to Generate Text with Citations https://arxiv.org/abs/2305.14627
[10] Qwen model https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF
