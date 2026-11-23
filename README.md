# CampusCompass 2.0

An evidence-based campus helpdesk from **Team AetherMind · PE-B37-13 · SCSE4041 · Bennett University**.

## Run the app

| Mode | Open it | What runs where |
| --- | --- | --- |
| Offline | Extract the ZIP and open `CampusCompass.html` in a browser | The browser resolves questions, shows citations, replays recorded experiments and runs the evaluation suite |
| Local API | Run `node source/server.js` from the project folder and open [http://127.0.0.1:8000](http://127.0.0.1:8000) | A local Node.js server processes questions and returns citations. It binds to loopback by default |
| Hosted | Open the [CampusCompass site](https://campuscompass-pe-b37-13.woodsymint128.chatgpt.site) with the project owner’s access | The hosted API runs the same evidence engine |
| Local model | Run `python3 source/serve_model.py --model /path/to/model.gguf` and open Prompt Studio | The local server loads a GGUF model, assembles each prompt and validates the response |

Use Node.js 18.17 or later for the server and Python 3.10 or later to build or use the model bridge. The offline app requires a modern browser. The built app and the helpdesk API need no package installation or API key.

## What to try

1. Open the helpdesk and choose **Attendance** to see a dated answer and the official document excerpt.
2. Ask **When do classes start?**, select **2026-27** and **Returning** under **Refine scope**, and check the calendar citation.
3. Open **Evidence Library** and search for a topic, source title or fact ID such as `F14`.
4. In **Prompt Studio**, choose **V5** and **Use in validator** on recorded case D01. Try the unapproved ID to see the validator hold the draft.
5. Run the checks in **Evaluation** and use the case filter to inspect the challenge set.

The browser keeps up to five recent answered questions on the device. Use **Clear** in Recent questions to remove them. The interface marks historical sources and links to the official service desk when a question needs university support.

## Backend API

Input scope accepts the keys `program`, `year`, `semester` and `audience`. Scope is optional. The server resolves the scope in the question before choosing evidence.

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/health` | Release, runtime and local model status |
| GET | `/api/sources` | Source metadata and curated facts |
| POST | `/api/answer` | Cited answer or a clarification, coverage, conflict or privacy decision |
| POST | `/api/validate` | Verdict for the supplied model draft and current question |
| POST | `/api/model` | Optional local inference output and validator verdict |

```bash
curl http://127.0.0.1:8000/api/answer \
  -H 'Content-Type: application/json' \
  -d '{"question":"When do classes start?","scope":{"year":"2026-27","audience":"Returning"}}'
```

Use `question` and optional `scope` for `/api/answer`. Add `draft` for `/api/validate`, or `version` from V0 to V5 for `/api/model`. V5 is the default. Request errors include a code and message. Answer decisions identify the evidence and preserve the source quote, location, issue date and applicability note.

## Build and verify

```bash
npm run build
npm test
```

The build generates `CampusCompass.html` and the identical `dist/index.html`. The test command runs component, scope, citation and backend checks, re-scores the 48 saved model outputs, and builds and tests the Worker at `dist/server/index.js`. Both runtime APIs and the browser use `source/engine.js`. The local server and the Worker share `source/api.js`. The archive’s file hashes are in `SHA256SUMS.json`.

## Optional GGUF inference

Install the separate dependency with `python3 -m pip install -r requirements-model.txt`. Download the model and compare its SHA-256 with `evidence/model_run_manifest.json`. The original 48 completions used Qwen2.5-0.5B-Instruct Q4_K_M. [Official model repository](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF)

The model process handles one generation at a time. Prompt Studio displays its raw output and applies the backend evidence validator before treating any fact IDs as approved. The hosted site supports recorded replay and leaves GGUF inference to a local machine.

To reproduce the three historic experiment batches, keep a copy of the saved evidence and run `python3 source/run_model.py MODEL_PATH`, `python3 source/run_v4.py MODEL_PATH` and `python3 source/run_v5.py MODEL_PATH`. Then run `npm test`. The inference scripts write into `evidence/`. The archived experimental engine and corpus define the replay scores.

## Evidence and submission

The library covers five official sources and 19 curated facts. Check the source date, scope and any newer notice before relying on a campus rule. Fee amounts, personal records and individual timetables belong with the official university services.

The Milestone 3 project ZIP includes the original report, presentation and demo in `final/` as the academic record for the earlier interface. The engineering release is documented by this README, the changelog and the current test evidence.
