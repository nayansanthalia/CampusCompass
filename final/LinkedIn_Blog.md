# Can a campus chatbot show why its answer applies?

When students ask about an exam, a certificate or a hostel rule, the answer often depends on the document and the student's situation. A fluent reply is easy to read. A reply tied to the right source is much easier to check.

We built CampusCompass for our SCSE4041 Prompt Engineering mini-project at Bennett University. It explores a small set of university documents and links each supported answer to its source. It can ask for the academic year, flag an evidence gap, or direct a student to the official service desk. The prototype is an independent course project.

In our first experiments, a local Qwen model could return valid JSON and still pick irrelevant facts. We gave it a narrower evidence set and an explicit list of allowed fact IDs. Two responses then copied a schema placeholder. Changing the schema representation took contract acceptance from six to eight out of eight development questions.

Our browser workflow exposed a different problem. The right fact sometimes appeared in retrieval, but the router did not recognize the phrasing. Three targeted adjustments raised status matches from 39 to 42 on the same 42 cases. Twelve additional internal checks exercised citations, unsupported requests and privacy refusals.

These are small prototype tests. Wider evaluation would need questions written independently of the developers and review of the actual policy passages. The most useful next experiment is to measure whether students can find and confirm the correct official source faster.

TEAM AETHERMIND · PE-B37-13 · Bennett University
