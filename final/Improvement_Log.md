# Milestone 3 improvement log

1. **Compute retrieval stopwords once.** Changed `source/engine.js`.
2. **Return a clarification for empty or punctuation-only input.** Changed `source/engine.js`.
3. **Use word boundaries for month-based scope inference.** Changed `source/engine.js`.
4. **Limit the router to a single bounded question.** Changed `source/engine.js`.
5. **Identify the active view on the initial render.** Changed `app/index.template.html`.
6. **Label the evaluation results region for assistive technology.** Changed `app/index.template.html`.
7. **Announce prompt validation decisions.** Changed `app/index.template.html`.
8. **Keep the evaluation action label accurate as the test set grows.** Changed `app/index.template.html`.
9. **Expose selected navigation view.** Changed `app/app.js`.
10. **Expose selected prompt version.** Changed `app/app.js`.
11. **Prevent an earlier toast timer from hiding newer feedback.** Changed `app/app.js`.
12. **Remove unused stored answer state.** Changed `app/app.js`.
13. **Refresh prompt context as the question or scope changes.** Changed `app/app.js`.
14. **Validate live model results against their original request.** Changed `app/app.js`.
15. **Calculate displayed evidence counts from the corpus.** Changed `app/app.js`.
16. **Report status and expected evidence separately in the browser bench.** Changed `app/app.js`.
17. **Give evaluation table headers explicit column semantics.** Changed `app/app.js`.
18. **Make component checks fail on routing or selected evidence regressions.** Changed `source/test.js`.
19. **Make component split counts follow test data.** Changed `source/test.js`.
20. **Require evaluation and compile checks for a repeatable release.** Changed `START_HERE.md`.

The final combined release passed 42 routing and expected-evidence cases, 12 additional cases, eight scope and input cases, ten validator fixtures, two synthetic policy checks and the replay-score checks for 48 saved model responses. The release checker verifies the bundle structure and JavaScript syntax. These are implementation changes and local tests. The saved V0–V5 prompt experiment remains the same.
