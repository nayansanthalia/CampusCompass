# Final demo transcript

Synthetic narration and recorded prototype captures. Screens show the earlier prototype where the interface is shared.

## CampusCompass

Campus Compass asks a simple question. Can students see why a campus policy answer applies? We built a source grounded helpdesk prototype for our prompt engineering project at Bennett University. It connects a limited set of questions to official evidence and makes uncertainty visible.

## Why scope matters

A student looking up a rule may find a notice from a different cohort. A certificate request may also need action from staff. Bennett already provides registrar resources and a service desk. Our prototype helps students find evidence and routes them to the official channel when appropriate.

## What existing tools teach us

We reviewed repository documentation for university PDF assistants, a hybrid retrieval chatbot, and Rulebook AI. These projects already demonstrate citations, refusals and conflict handling. We focused our work on Bennett specific scope and an inspectable evaluation. The comparison concerns documented features.

## Follow the source

Here is the attendance example from our helpdesk. The user sees a curated answer and the official source citation. The historical warning asks the student to verify present applicability. The evidence format is designed to help a student check what the document actually said.

## Handle missing evidence

A hostel fee or refund can depend on details the assistant does not have. The workflow asks for those details and avoids citing unrelated documents. The final version also links to the official service desk so students can contact the university when they need an authoritative answer.

## Inspect the prompt

In the prompt studio we expose the instructions and data sent to the local Qwen model. The application supplies a permitted status and fact identifiers. The model emits a structured draft. The validator checks that the selection matches the evidence, and the renderer keeps source wording under application control.

## Valid JSON can still fail

Version three produced valid JSON in all eight development cases, but passed only one complete output contract. A draft can select a real fact that answers an entirely different question. The validator checks relevance and scope as well as JSON syntax and fact membership.

## Refine the output schema

Version four used a trusted gate and narrower evidence. Two outputs copied a placeholder. Version five changed the schema representation to a formal typed object. It passed the contract in all eight development cases. Forty eight actual responses across six versions are included for reproduction.

## Recheck the final workflow

The original router missed three paraphrases even when retrieval found the relevant fact. Targeted aliases recover those cases, and the final build passes the existing forty two routing checks. Twelve additional internal questions test status and fact selection. These checks are small and were authored within the project.

## Where we go next

The standalone app uses curated evidence. The prompt studio supports replay and optional local inference. A wider study needs independently written student queries and policy owner review, especially for current rules and exceptions. The final package includes the report, source, prompt history and evaluation results.