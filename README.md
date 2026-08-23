# Criscris

**Interactive Emergency Response Simulation powered by real-time world models**

Built by **Kaushik Yellanki**

Criscris transforms emergency-response training from passive instruction into an interactive simulation where users navigate an evolving warehouse-fire environment, make critical decisions, and receive a scored performance debrief.

Traditional emergency training tells people what to do. Criscris puts them inside an evolving emergency and makes them decide.

## Overview

Criscris is a browser-based emergency-response simulation built for the Inception II World Models Hackathon. The current version focuses on one scenario, Warehouse Fire — Simulation 01, and supports both a live Reactor world-model mode and a mock fallback mode for reliable demonstrations.

## Problem

Most safety training is passive: slides, videos, quizzes, and checklists. Those formats do not recreate uncertainty, deteriorating conditions, spatial judgment, or the pressure of deciding when to evacuate.

## Solution

Criscris gives the trainee a timed emergency scenario with a navigable world, escalating hazard levels, recorded decisions, deterministic scoring, and a professional evidence package at the end of the run.

## Demo Flow

1. Start Warehouse Fire — Simulation 01.
2. Navigate the world with W/A/S/D and arrow-key look controls.
3. Observe the emergency escalate from LOW to HIGH to CRITICAL.
4. Choose emergency actions such as reporting, searching, attempting fire control, or evacuating.
5. Complete the simulation by evacuating or timing out.
6. Review the debrief, score, action timeline, PDF report, recording download, and Gmail supervisor flow.
7. Restart normally.

Use `?demo=1` for a shorter 75-second demo timeline.

## Key Features

- Real-time generated warehouse environment
- WASD navigation and arrow-key look controls
- Dynamic LOW → HIGH → CRITICAL emergency escalation
- Emergency decision recording
- Deterministic performance scoring
- Professional debrief with category breakdowns
- Downloadable PDF assessment
- Downloadable simulation recording
- Gmail supervisor reporting flow
- Demo fallback mode

## How Reactor Is Used

Reactor is not used as a decorative video generator. It powers the navigable world-model simulation environment.

In Reactor mode, Criscris uses `@reactor-models/lingbot-world-2` to create the live warehouse world. The server mints a short-lived model-scoped JWT from a server-only `REACTOR_API_KEY`; the browser receives only that temporary token. The client connects to LingBot World 2, uploads the warehouse seed image, sends the scenario prompt, starts generation, renders the `main_video` stream, and forwards movement/look commands from the simulation controls.

As conditions worsen, Criscris sends updated HIGH and CRITICAL prompts to the active world session while preserving the same deterministic scenario and scoring rules.

## Architecture

- `src/components/crisis/` renders the briefing, viewport, decision panel, and debrief.
- `src/hooks/useSimulation.ts` owns simulation lifecycle, keyboard input, recording state, restart behavior, and provider coordination.
- `src/lib/scenario/` contains scenario timing, prompts, domain types, and deterministic scoring.
- `src/lib/world/` defines the shared `WorldProvider` interface plus mock and Reactor implementations.
- `src/lib/reactor/` contains safe token client/server helpers.
- `src/lib/export/` creates report files, recording downloads, filenames, and supervisor email text.
- `src/routes/api/reactor-token.ts` exposes the server route for short-lived Reactor session tokens.

## Technology Stack

- TypeScript
- React
- TanStack Start
- TanStack Router
- Vite
- Tailwind CSS
- Reactor LingBot World 2
- Browser `MediaRecorder`
- Client-side PDF generation

## Scenario Logic

The simulation has four stages:

- `briefing`: scenario setup before the run begins
- `low`: initial smoke and assessment window
- `high`: conditions deteriorate and evacuation planning becomes urgent
- `critical`: immediate evacuation is recommended
- `complete`: evacuation or timeout ends the run

Normal timing:

- HIGH at 35 seconds
- CRITICAL at 75 seconds
- Timeout at 150 seconds

Demo timing with `?demo=1`:

- HIGH at 15 seconds
- CRITICAL at 35 seconds
- Timeout at 75 seconds

## Scoring System

The score is deterministic and totals 100 points:

- Situational Awareness: 20
- Emergency Reporting: 20
- Risk Assessment: 20
- Response Time: 20
- Evacuation Decision: 20

The debrief also lists positive actions, improvement areas, outcome, response time, and the action timeline. Scores are prototype heuristics and are not a formal safety certification.

## Simulation Evidence

At completion, Criscris provides a professional evidence workflow:

- Download Report creates a PDF summary of the completed simulation.
- Download Recording saves the browser-recorded world video when a real stream is available.
- Email Supervisor opens Gmail Web Compose with a structured summary for the entered supervisor email.

Browser compose URLs cannot attach local Blob files automatically, so the PDF report and recording remain separate downloads for the trainee to attach manually.

## Running Locally

Install dependencies:

```sh
npm install
```

Start development:

```sh
npm run dev
```

Build production output:

```sh
npm run build
```

Run lint:

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

Mock mode is the default and requires no external credentials.

## Deployment

Reactor mode requires a deployment target that supports the TanStack Start server route at `/api/reactor-token`. Static frontend-only hosting is not sufficient for the live Reactor mode because the permanent Reactor API key must remain server-only.

## Project Structure

```text
src/
  components/crisis/   Criscris screens and simulation controls
  hooks/               simulation state and recording lifecycle
  lib/export/          report, download, and supervisor email helpers
  lib/reactor/         Reactor token helpers
  lib/scenario/        scenario timing, prompts, types, and scoring
  lib/world/           mock and Reactor world providers
  routes/              app route and server API route
public/
  warehouse-seed.jpg
```

## Hackathon

Criscris was built for the Inception II World Models Hackathon in the Robotics / Simulation track.

## Limitations

- Criscris is a prototype training simulation, not an official emergency-response certification.
- The current MVP includes one scenario: Warehouse Fire — Simulation 01.
- Reactor mode depends on a valid server-side Reactor API key, service availability, and available credits.
- No database, accounts, or long-term simulation history are included.
