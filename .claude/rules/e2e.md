---
paths:
  - "e2e/**/*.js"
---

# E2E rules (Playwright)

- Plain JavaScript, not TypeScript. This is a deliberate decision, see
  `decision.log`. Do not "fix" it by converting specs to .ts.
- Tests run against the API with `MOCK_LLM=1`. A spec that hits the real Groq
  API is a broken spec: it is slow, costs money, and is non-deterministic.
- Mock replies are fixtures in `e2e/fixtures/`. To test a new conversational
  path, add a fixture rather than loosening an assertion.
- Cover at minimum, and keep these green:
  - under-18 onboarding never reaches the session screen
  - adult onboarding reaches the session screen and gets a streamed reply
  - the disclaimer is visible on onboarding
  - a crisis-indicating fixture reply renders resources and the phone link
- Assert on user-visible text and roles, not on CSS classes or DOM structure.
- No `waitForTimeout`. Wait on a locator, a response, or a store-driven state.
