---
paths:
  - "apps/web/**/*.{ts,vue}"
---

# Frontend rules (apps/web)

## State
- Pinia only. No global reactive singletons outside a store, no provide/inject
  for session state.
- `useSessionStore` owns the transcript. It is in-memory by design: a page
  refresh ends the session and that is the intended behavior, not a bug to fix
  with localStorage. Do not add browser persistence of transcript content.
- Onboarding answers (age band, presenting issue) live in `useOnboardingStore`
  and are passed to the API per request. Do not cache them in storage either.

## Components
- `<script setup lang="ts">` with the Composition API.
- Components render state and emit intent. API calls go through
  `src/api/session.ts`, never inside a component.
- The streaming reply is appended token by token to the store; components just
  read it. Do not hold partial text in component-local refs.

## UX constraints that are product requirements
- The disclaimer ("this is not therapy, not a licensed professional") must be
  visible on the onboarding screen and reachable from the session screen.
  Never remove it to clean up the layout.
- Crisis resources rendered by the assistant must stay selectable text with a
  tappable phone link. Do not swallow them into a styled component that breaks
  copy/paste.
- No analytics, session replay, or error reporter that could capture the text
  of the conversation. Error reporting must scrub message bodies.
