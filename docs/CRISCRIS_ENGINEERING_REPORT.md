# CRISCRIS Engineering Report

## 1. Executive Summary

Frontend: 95%
Scenario engine: 95%
Scoring: 95%
Mock mode: 100%
Reactor: 80%
Deployment: 80%
Submission readiness: 85%

Criscris is buildable and demo-ready in mock mode. Reactor SDK integration is implemented behind the `WorldProvider` layer with secure server-side token minting, seed upload, prompt setting, `main_video` streaming, movement controls, and live hazard prompt updates. Real Reactor mode still needs a valid `REACTOR_API_KEY`, credits, and manual production verification.

## 2. Initial Problems Found

- README still contained generic Lovable project copy.
- Repository had mixed line endings/formatting that caused `npm run lint` to fail with Prettier errors.
- Reactor scaffolding existed but needed SDK/API verification against installed package docs and types.
- Reactor provider reset behavior could reinitialize a new model after reset without clearly reusing the existing connected SDK session.
- User-facing text had several encoding artifacts in Criscris UI surfaces.
- Browser automation was unavailable in this Codex session.
- No test runner is currently configured in `package.json`.

## 3. Changes Made

- `README.md`: replaced generic Lovable README with Criscris hackathon documentation.
- `.env.example`: confirms safe placeholders for `REACTOR_API_KEY` and `VITE_WORLD_PROVIDER`.
- `.gitignore`: confirms `.env`, `.env.*`, and `*.local` are ignored while `.env.example` remains trackable.
- `src/lib/reactor/mintToken.ts`: secure server token exchange using `REACTOR_API_KEY`, safe structured errors, timeout handling, malformed-response handling, and model authorization for `reactor/lingbot-world-2`.
- `src/lib/reactor/fetchClientToken.ts`: client-side token fetch wrapper with safe error messages.
- `src/routes/api/reactor-token.ts`: TanStack Start API route for Reactor token minting.
- `src/lib/world/reactorWorldProvider.ts`: LingBot World 2 provider with JWT retrieval, seed upload, image/prompt setup, `main_video`, movement/look controls, prompt updates, pause/resume/reset/dispose, and sanitized command-error handling.
- `src/lib/world/mockWorldProviders.ts`: mock provider retained for full local demo fallback.
- `src/hooks/useSimulation.ts`: audited timer, stage progression, keyboard idle-on-keyup, blur reset, restart, scoring trigger, duplicate action prevention, and provider lifecycle.
- `src/components/crisis/*`: cleaned visible copy/separators and preserved mock/Reactor viewport distinction.
- Project formatting: ran Prettier to resolve lint-breaking formatting.

## 4. Reactor Integration

- SDK package: `@reactor-models/lingbot-world-2` version `^0.5.0`.
- Auth flow: browser POSTs `/api/reactor-token`; server uses `REACTOR_API_KEY` to call `https://api.reactor.inc/tokens`; browser receives only `{ jwt }`.
- Token endpoint: `src/routes/api/reactor-token.ts`.
- Model ID: `reactor/lingbot-world-2`.
- Seed image: `public/warehouse-seed.jpg`.
- Video stream: `LingbotWorld2Model.onMainVideo((_track, stream) => ...)`, rendered by `WorldViewport`.
- Controls:
  - W: `setMoveLongitudinal({ move_longitudinal: "forward" })`
  - S: `setMoveLongitudinal({ move_longitudinal: "back" })`
  - A: `setMoveLateral({ move_lateral: "strafe_left" })`
  - D: `setMoveLateral({ move_lateral: "strafe_right" })`
  - ArrowLeft/ArrowRight: `setLookHorizontal`
  - ArrowUp/ArrowDown: `setLookVertical`
  - keyup and window blur send `idle`.
- Live prompt updates: LOW at initialization, HIGH and CRITICAL through `setScenarioPrompt`.
- Errors handled: missing API key, auth failure, rate limit, 5xx, timeout, network failure, malformed token response, image rejection, prompt rejection, start failure, credits/quota messages, and non-fatal movement command errors.

## 5. Scenario Logic

- BRIEFING: user sees scenario setup and starts the simulation.
- LOW: starts after provider initialization and `start()`, uses `LOW_PROMPT`, objective asks user to assess smoke.
- HIGH: at `config.highAtSeconds`, hazard becomes HIGH and provider receives `HIGH_PROMPT`.
- CRITICAL: at `config.criticalAtSeconds`, hazard becomes CRITICAL and provider receives `CRITICAL_PROMPT`.
- COMPLETE: evacuation or timeout stops the run, pauses provider, calculates score, and shows debrief.

Normal timing:

- HIGH at 35 seconds.
- CRITICAL at 75 seconds.
- Timeout at 150 seconds.

Demo timing with `?demo=1`:

- HIGH at 15 seconds.
- CRITICAL at 35 seconds.
- Timeout at 75 seconds.

## 6. Scoring Rules

The score is deterministic and clamped from 0 to 100.

- Situational Awareness: search before CRITICAL and report before CRITICAL.
- Emergency Reporting: earlier reports score higher.
- Risk Assessment: unsafe fire-control attempts reduce score, especially at CRITICAL.
- Response Time: evacuation time determines response score.
- Evacuation Decision: HIGH evacuation is ideal, CRITICAL is late, LOW is early.

Edge cases audited: no actions, no report, immediate evacuation, late evacuation, timeout, unsafe CRITICAL fire control, duplicate evacuation, duplicate non-evacuation actions, and score bounds.

## 7. Environment Variables

- `REACTOR_API_KEY`
- `VITE_WORLD_PROVIDER`

## 8. Commands Executed

- `git status --short`
- `rg --files`
- `rg` audits for architecture spec, env vars, secrets, Reactor usage, and Lovable placeholders
- `npm install`
- `npm run build`
- `npm run lint`
- `npm run format`
- HTTP probe for `http://127.0.0.1:4177/?demo=1`
- HTTP POST probe for `http://127.0.0.1:4177/api/reactor-token`

## 9. Tests Performed

- PASS: architecture document read and applied.
- PASS: dependency install completed.
- PASS: production build completed.
- PASS: lint has no errors.
- PASS: `/api/reactor-token` returns safe structured missing-key error without exposing secrets.
- PASS: app HTML serves locally and contains Criscris/Start Simulation.
- PASS: SDK README/types inspected for real LingBot API methods.
- PASS: security scan found no committed key values.
- PASS: source audit confirmed keyup and blur send idle movement/look states.
- PASS: source audit confirmed duplicate non-evacuation actions are blocked and evacuation completes once.
- PASS: source audit confirmed restart resets timer/state/provider.
- NOT RUN: visual browser click-through; browser automation was unavailable in this session.
- NEEDS API KEY: live Reactor world/video verification.

## 10. Build Status

`npm run build`: PASS.

Build output was generated under `.output`. Vite/Nitro reported successful client, SSR, and server builds.

`npm run lint`: PASS with warnings.

Remaining warnings are generated shadcn/ui fast-refresh warnings in:

- `src/components/ui/badge.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/form.tsx`
- `src/components/ui/navigation-menu.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/toggle.tsx`

## 11. Remaining Blockers

- Real Reactor mode cannot be proven end-to-end without a valid `REACTOR_API_KEY` and available Reactor credits.
- Browser automation was unavailable, so visual interaction validation must be done manually.
- Public deployment still needs hosting credentials/environment configuration.

## 12. Manual Actions Required From Me

1. Add `REACTOR_API_KEY` as a server-side deployment secret.
2. Set `VITE_WORLD_PROVIDER=reactor` for the production Reactor demo.
3. Deploy to a host that supports the TanStack Start/Nitro server route.
4. Manually verify Reactor world/video/movement with credits available.
5. Record demo video.
6. Submit public URL, repository, and video to the hackathon form.

## 13. Known Limitations

- Criscris is a prototype simulation, not certified safety training.
- Mock mode uses a static warehouse seed image with hazard visual effects.
- Reactor mode depends on external service availability and credits.
- No database, accounts, or persistent history are included by design.
- No unit test framework is currently configured.

## 14. Deployment Instructions

1. Install dependencies:

```sh
npm install
```

2. Build:

```sh
npm run build
```

3. Configure production environment:

```env
REACTOR_API_KEY=
VITE_WORLD_PROVIDER=reactor
```

4. Deploy `.output` using the generated Nitro target or the hosting provider's TanStack Start flow.

5. Verify:

- `/` loads.
- `/api/reactor-token` POST succeeds when secret is configured.
- Reactor world starts.
- `main_video` renders.
- keyup/blur stops motion.
- HIGH and CRITICAL prompt updates occur.
- evacuation reaches debrief.

## 15. Demo Instructions

Mock backup demo:

1. Run `npm run dev`.
2. Open `http://localhost:5173/?demo=1` or the printed local URL with `?demo=1`.
3. Click Start Simulation.
4. Move with W/A/S/D and arrow keys.
5. Click Report Emergency.
6. Wait for HIGH.
7. Click Search For Workers.
8. Wait for CRITICAL.
9. Click Evacuate.
10. Show score/debrief.
11. Click Restart Simulation.

Reactor demo:

1. Configure server-side `REACTOR_API_KEY`.
2. Set `VITE_WORLD_PROVIDER=reactor`.
3. Start/deploy app.
4. Open `?demo=1`.
5. Confirm viewport label says Reactor World.
6. Start simulation and wait for generated video.
7. Demonstrate W/A/S/D and key release.
8. Let prompt transitions reach HIGH and CRITICAL.
9. Evacuate and show debrief.

## 16. Submission Readiness Checklist

- [ ] public deployment
- [ ] GitHub repo
- [x] README
- [ ] demo video
- [ ] Reactor working
- [ ] submission form
- [x] mock mode backup
- [x] production build
- [x] engineering report
