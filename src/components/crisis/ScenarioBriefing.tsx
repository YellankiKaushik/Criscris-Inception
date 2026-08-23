import { useState } from "react";
import { cn } from "@/lib/utils";

interface ScenarioBriefingProps {
  onStart: () => void;
  starting: boolean;
  error?: string | null;
  providerKind?: "mock" | "reactor";
  onRetryLiveWorld?: () => void;
  onSwitchToDemo?: () => void;
}

const scenarioFacts = [
  ["Scenario", "Industrial warehouse fire"],
  ["Your role", "Worker / responder inside the eastern warehouse sector"],
  ["Initial condition", "Smoke reported near racking aisles"],
  ["Objective", "Assess, report, search, manage risk, and evacuate appropriately"],
  ["Session", "Decision type, timing, and scenario stage are recorded"],
] as const;

const useSteps = [
  ["01", "Enter the world", "Start the warehouse scenario and wait for the world to initialize."],
  ["02", "Navigate", "Use W/A/S/D to move and arrow keys to look around."],
  ["03", "Make decisions", "Report, search, assess fire control, or evacuate."],
  ["04", "Review performance", "Receive a score, timeline, PDF report, and evidence options."],
] as const;

const decisionCards = [
  ["Report Emergency", "Radio the emergency to the site fire response team."],
  ["Search For Workers", "Sweep nearby aisles for remaining personnel."],
  ["Attempt Fire Control", "Consider direct suppression with on-site equipment."],
  ["Evacuate", "Leave the building via the nearest safe exit and complete the run."],
] as const;

const scoringCategories = [
  "Situational Awareness",
  "Emergency Reporting",
  "Risk Assessment",
  "Response Time",
  "Evacuation Decision",
] as const;

const afterRun = [
  [
    "Performance Debrief",
    "Overall score, risk band, category scores, positives, improvements, and action timeline.",
  ],
  ["PDF Report", "Client-side assessment PDF with scenario outcome, scoring, and timeline."],
  ["Simulation Recording", "Live Reactor sessions can be recorded from the browser MediaStream."],
  [
    "Email Supervisor",
    "Gmail compose opens with a structured summary; downloads can be attached manually.",
  ],
] as const;

const controls = [
  ["W", "Forward"],
  ["A", "Strafe left"],
  ["S", "Backward"],
  ["D", "Strafe right"],
  ["Left", "Look left"],
  ["Right", "Look right"],
  ["Up", "Look up"],
  ["Down", "Look down"],
] as const;

const liveVsDemo = [
  [
    "Live Reactor World",
    "Real LingBot World 2 session, generated world, actual main_video stream, live movement/look commands, recordable video stream, depends on Reactor availability.",
  ],
  [
    "Demo World",
    "Deterministic local fallback, interactive warehouse visualization, same decisions and scoring, no live AI-generated stream, recording unavailable by design.",
  ],
] as const;

export function ScenarioBriefing({
  onStart,
  starting,
  error,
  providerKind = "mock",
  onRetryLiveWorld,
  onSwitchToDemo,
}: ScenarioBriefingProps) {
  const [showScoring, setShowScoring] = useState(false);
  const startLabel = providerKind === "reactor" ? "Start Live Simulation" : "Start Demo Simulation";

  return (
    <main className="grid-backdrop min-h-screen px-4 py-8 sm:px-6 lg:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,430px)] lg:items-start">
          <div className="pt-2">
            <p className="label-tech">Emergency response simulation</p>
            <h1 className="mt-2 font-display text-5xl font-bold uppercase sm:text-6xl lg:text-7xl">
              Criscris
            </h1>
            <p className="mt-4 max-w-2xl font-display text-2xl font-semibold uppercase leading-tight sm:text-3xl">
              Training videos tell you what to do. Criscris puts you inside the emergency and makes
              you decide.
            </p>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Interactive emergency-response decision training powered by a real-time world model.
              Navigate an escalating warehouse fire, make timed choices, evacuate, and review a
              deterministic performance assessment.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {["Warehouse Fire", "Robotics", "World Model Simulation", "Prototype"].map((chip) => (
                <span
                  key={chip}
                  className="label-tech rounded border border-border bg-surface px-2.5 py-1"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <article className="rounded border border-border bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
                Warehouse Fire - Simulation 01
              </h2>
              <span
                className={cn(
                  "label-tech rounded border px-2 py-0.5",
                  providerKind === "reactor"
                    ? "border-hazard-low/50 text-hazard-low"
                    : "border-hazard-high/50 text-hazard-high",
                )}
              >
                {providerKind === "reactor" ? "Live Reactor World" : "Demo World"}
              </span>
            </div>

            <dl className="mt-5 grid gap-3">
              {scenarioFacts.map(([label, value]) => (
                <div key={label} className="border-l-2 border-primary/70 pl-3">
                  <dt className="label-tech">{label}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground sm:text-base">{value}</dd>
                </div>
              ))}
            </dl>

            <button
              type="button"
              onClick={onStart}
              disabled={starting}
              className={cn(
                "mt-7 w-full rounded bg-primary px-6 py-3.5 font-display text-base font-semibold uppercase tracking-widest text-primary-foreground transition-colors",
                "hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                starting && "opacity-70",
              )}
            >
              {starting ? "Initializing world..." : startLabel}
            </button>

            <p className="mt-3 text-xs text-muted-foreground">
              `?demo=1` accelerates timing only. Demo World is the local mock provider.
            </p>

            {error && (
              <div className="mt-4 rounded border border-hazard-critical/50 bg-hazard-critical/10 p-3 text-sm">
                <p className="font-medium text-hazard-critical">World failed to start</p>
                <p className="mt-1 text-muted-foreground">{error}</p>
                {providerKind === "reactor" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {onRetryLiveWorld && (
                      <button
                        type="button"
                        onClick={onRetryLiveWorld}
                        className="rounded bg-primary px-3 py-1.5 font-display text-xs uppercase tracking-widest text-primary-foreground"
                      >
                        Retry Live World
                      </button>
                    )}
                    {onSwitchToDemo && (
                      <button
                        type="button"
                        onClick={onSwitchToDemo}
                        className="rounded border border-border px-3 py-1.5 font-display text-xs uppercase tracking-widest"
                      >
                        Switch to Demo Mode
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </article>
        </section>

        <section className="mt-10">
          <h2 className="label-tech">How to use Criscris</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {useSteps.map(([number, title, copy]) => (
              <article key={number} className="rounded border border-border bg-surface p-4">
                <p className="font-mono text-sm text-primary">{number}</p>
                <h3 className="mt-2 font-display text-base font-semibold uppercase tracking-wide">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="label-tech">Controls</h2>
            <div className="mt-4 rounded border border-border bg-surface p-4">
              <div className="grid grid-cols-[repeat(3,minmax(48px,1fr))] gap-2">
                <span />
                <KeyCap label="W" />
                <span />
                <KeyCap label="A" />
                <KeyCap label="S" />
                <KeyCap label="D" />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <KeyCap label="Left" />
                <KeyCap label="Up" />
                <KeyCap label="Down" />
                <KeyCap label="Right" />
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {controls.map(([key, action]) => (
                  <div key={key} className="flex justify-between gap-3 border-t border-border pt-2">
                    <dt className="font-mono text-muted-foreground">{key}</dt>
                    <dd>{action}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div>
            <h2 className="label-tech">The emergency evolves</h2>
            <div className="mt-4 grid gap-3">
              {[
                ["LOW", "Initial smoke / investigation", "border-hazard-low text-hazard-low"],
                [
                  "HIGH",
                  "Visibility worsens / risk increases",
                  "border-hazard-high text-hazard-high",
                ],
                [
                  "CRITICAL",
                  "Severe conditions / immediate evacuation recommended",
                  "border-hazard-critical text-hazard-critical",
                ],
              ].map(([stage, copy, tone]) => (
                <article key={stage} className={cn("rounded border bg-surface p-4", tone)}>
                  <p className="font-display text-lg font-semibold uppercase tracking-wide">
                    {stage}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
                </article>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              In Live Reactor mode, updated scenario prompts are sent to the active world session as
              conditions progress from LOW to HIGH to CRITICAL.
            </p>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="label-tech">Your decisions</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {decisionCards.map(([title, copy]) => (
                <article key={title} className="rounded border border-border bg-surface p-4">
                  <h3 className="font-display text-base font-semibold uppercase tracking-wide">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
                </article>
              ))}
            </div>
          </div>

          <div>
            <h2 className="label-tech">How you are scored</h2>
            <div className="mt-4 rounded border border-border bg-surface p-4">
              <p className="text-sm text-muted-foreground">
                Criscris produces a 100-point deterministic prototype score. Each category is worth
                20 points.
              </p>
              <ul className="mt-4 grid gap-2">
                {scoringCategories.map((category) => (
                  <li
                    key={category}
                    className="flex items-center justify-between gap-3 border-t border-border pt-2 text-sm"
                  >
                    <span>{category}</span>
                    <span className="font-mono text-muted-foreground">20 pts</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowScoring((v) => !v)}
                  aria-expanded={showScoring}
                  className="label-tech hover:text-foreground"
                >
                  Scoring detail {showScoring ? "-" : "+"}
                </button>
                {showScoring && (
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p>
                      Early reporting, pre-critical search, measured fire-control risk, response
                      time, and evacuation stage determine the score.
                    </p>
                    <p>
                      Scoring is a deterministic prototype heuristic for demonstration only. It is
                      not a formal safety certification.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="label-tech">Two ways to run Criscris</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {liveVsDemo.map(([title, copy]) => (
              <article key={title} className="rounded border border-border bg-surface p-5">
                <h3 className="font-display text-lg font-semibold uppercase tracking-wide">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <h2 className="label-tech">How the live world works</h2>
            <div className="mt-4 rounded border border-border bg-surface p-5">
              <div className="grid gap-3 text-center font-mono text-xs uppercase text-muted-foreground sm:grid-cols-5 sm:items-center">
                <FlowBox label="Warehouse seed" />
                <FlowArrow />
                <FlowBox label="Reactor LingBot World 2" />
                <FlowArrow />
                <FlowBox label="Live generated world" />
              </div>
              <div className="mt-4 grid gap-3 text-center font-mono text-xs uppercase text-muted-foreground sm:grid-cols-5 sm:items-center">
                <FlowBox label="WASD / look controls" />
                <FlowArrow />
                <FlowBox label="Criscris scenario engine" />
                <FlowArrow />
                <FlowBox label="LOW -> HIGH -> CRITICAL prompts" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Reactor receives the seed image, initial prompt, movement/look commands, and
                escalation prompts. Criscris waits for the live `main_video` stream before starting
                the scenario timer.
              </p>
            </div>
          </div>

          <div>
            <h2 className="label-tech">After the run</h2>
            <div className="mt-4 grid gap-3">
              {afterRun.map(([title, copy]) => (
                <article key={title} className="rounded border border-border bg-surface p-4">
                  <h3 className="font-display text-base font-semibold uppercase tracking-wide">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <details className="rounded border border-border bg-surface p-5">
            <summary className="cursor-pointer font-display text-base font-semibold uppercase tracking-wide">
              Under the hood
            </summary>
            <div className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
              <p>React + TanStack Start render the app and server route.</p>
              <p>
                `useSimulation` owns the scenario state engine, timer, keyboard input, and
                recording.
              </p>
              <p>`WorldProvider` separates Live Reactor World from Demo World.</p>
              <p>
                `ReactorWorldProvider` manages LingBot World 2, prompts, commands, and `main_video`.
              </p>
              <p>`MockWorldProvider` provides the deterministic local fallback.</p>
              <p>
                Scoring, PDF export, MediaRecorder, and Gmail compose are isolated from world
                generation.
              </p>
            </div>
          </details>
        </section>

        <section className="mt-10 rounded border border-hazard-high/50 bg-hazard-high/10 p-4">
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-hazard-high">
            Prototype notice
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Criscris is a prototype interactive training simulation. It is not a certified
            emergency-response or workplace-safety assessment.
          </p>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border py-6 text-sm text-muted-foreground">
          <div>
            <p className="font-display text-base font-bold uppercase text-foreground">Criscris</p>
            <p>Built by Kaushik Yellanki</p>
            <p>Inception II World Models Hackathon - Robotics</p>
          </div>
          <a
            href="https://github.com/YellankiKaushik/Criscris-Inception"
            target="_blank"
            rel="noreferrer"
            className="label-tech hover:text-foreground"
          >
            GitHub Repository
          </a>
        </footer>
      </div>
    </main>
  );
}

function KeyCap({ label }: { label: string }) {
  return (
    <span className="flex min-h-11 items-center justify-center rounded border border-border bg-surface-raised px-2 py-2 text-center font-mono text-xs uppercase shadow-inner">
      {label}
    </span>
  );
}

function FlowBox({ label }: { label: string }) {
  return (
    <span className="rounded border border-border bg-surface-raised px-3 py-3 text-foreground">
      {label}
    </span>
  );
}

function FlowArrow() {
  return <span className="hidden text-primary sm:block">-&gt;</span>;
}
