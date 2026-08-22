# Criscris

## Overview

Criscris is an interactive emergency-response training simulation for the Inception II: World Models Hackathon. The MVP places a participant inside one industrial warehouse fire scenario, lets conditions escalate from LOW to HIGH to CRITICAL, records emergency-response decisions, and returns a deterministic performance debrief.

Traditional emergency training tells people what to do. Criscris puts them inside an evolving emergency and makes them decide.

## Problem

Passive safety training does not reproduce uncertainty, time pressure, deteriorating visibility, spatial navigation, or the cost of delayed decisions. Criscris demonstrates a training primitive where the environment changes while the participant is inside it.

## Solution

The user starts Warehouse Fire - Simulation 01, navigates a warehouse environment, sees hazards escalate, chooses from four response actions, evacuates, and receives a 100-point deterministic score.

## Why World Models

Reactor is not used as a decorative video generator. The Reactor world is the actual simulation environment. LingBot World 2 receives a warehouse seed image plus scenario prompts, streams `main_video`, accepts movement/look commands, and receives live prompt updates as the fire conditions worsen.

## Demo Flow

1. Open Criscris.
2. Start the warehouse fire simulation.
3. Show the world viewport.
4. Move with W/A/S/D and look with arrow keys.
5. Report emergency.
6. Let hazard escalate to HIGH.
7. Search for workers or attempt fire control.
8. Let hazard escalate to CRITICAL.
9. Evacuate.
10. Review score and debrief.
11. Restart.

Use `?demo=1` for a shorter 75-second demo timeline.

## Architecture

Criscris keeps product logic separate from world generation:

- React/TanStack Start UI renders briefing, simulation, viewport, controls, and debrief.
- `useSimulation` owns timer, state transitions, keyboard controls, decisions, restart, and provider lifecycle.
- `src/lib/scenario` owns prompts, timing config, types, and deterministic scoring.
- `src/lib/world` defines a shared `WorldProvider` contract with mock and Reactor implementations.
- `src/routes/api/reactor-token.ts` mints short-lived Reactor JWTs from the server-side API key.

## How Reactor Is Used

Real mode uses `@reactor-models/lingbot-world-2`:

- server exchanges `REACTOR_API_KEY` for a short-lived JWT;
- client connects with `LingbotWorld2Model`;
- `/warehouse-seed.jpg` is uploaded and passed to `setImage`;
- LOW prompt is passed to `setPrompt`;
- `start()` begins generation;
- `onMainVideo` provides the stream rendered in the viewport;
- W/S maps to `setMoveLongitudinal`;
- A/D maps to `setMoveLateral`;
- arrow keys map to look setters;
- keyup and window blur send `idle`;
- HIGH and CRITICAL stages call `setPrompt` live.

## Technology Stack

- TypeScript
- React
- TanStack Start
- TanStack Router
- Vite
- Tailwind CSS
- Reactor LingBot World 2
- Deterministic TypeScript scenario and scoring engines

## Running Locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. For a short demo run:

```text
http://localhost:5173/?demo=1
```

Production build:

```sh
npm run build
```

Lint:

```sh
npm run lint
```

## Environment Variables

```env
REACTOR_API_KEY=
VITE_WORLD_PROVIDER=mock
```

For production Reactor mode:

```env
VITE_WORLD_PROVIDER=reactor
```

`REACTOR_API_KEY` must be configured only as a server-side secret. Do not create `VITE_REACTOR_API_KEY`.

## Mock vs Reactor Mode

Mock mode is the default and requires no external credentials. It renders the warehouse seed image with hazard-responsive visual effects and supports the full briefing, action, scoring, debrief, and restart workflow.

Reactor mode uses LingBot World 2 as the live navigable environment. It requires server-side `REACTOR_API_KEY` and a deployment target that supports the `/api/reactor-token` server route.

## Scoring System

The score is deterministic and totals 100 points:

- Situational Awareness: 20
- Emergency Reporting: 20
- Risk Assessment: 20
- Response Time: 20
- Evacuation Decision: 20

The debrief also lists positive actions, improvement areas, outcome, response time, and the action timeline. Scores are prototype heuristics, not a certified safety assessment.

## Project Structure

```text
src/
  components/crisis/   Criscris screens and controls
  hooks/useSimulation.ts
  lib/scenario/        timing, prompts, scoring, types
  lib/reactor/         token client/server helpers
  lib/world/           mock and Reactor providers
  routes/              TanStack routes and API route
public/
  warehouse-seed.jpg
docs/
  CRISCRIS_DEEP_TECHNICAL_ARCHITECTURE.md
```

## Hackathon

Built for Inception II: World Models Hackathon, Robotics / Simulation track. The hackathon MVP intentionally contains one scenario only: Industrial Warehouse Fire.

## Known Limitations

- Reactor mode cannot be fully verified without a valid Reactor API key and available credits.
- The simulation is a prototype and not official emergency-response certification.
- No database or long-term user history is included.
- Browser automation was unavailable in the local Codex session, so final validation used build/lint, HTTP probes, token-route checks, SDK type inspection, and source audit.
