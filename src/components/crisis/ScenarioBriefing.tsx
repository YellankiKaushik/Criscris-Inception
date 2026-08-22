import { useState } from "react";
import { cn } from "@/lib/utils";

interface ScenarioBriefingProps {
    onStart: () => void;
    starting: boolean;
}

const bullets = [
    "You are on shift alone in the eastern section of an industrial warehouse.",
    "Smoke has been reported near the racking aisles. Conditions will escalate.",
    "Your decisions and their timing are recorded and scored at the end.",
];

export function ScenarioBriefing({ onStart, starting }: ScenarioBriefingProps) {
    const [showScoring, setShowScoring] = useState(false);

    return (
        <main className="grid-backdrop relative flex min-h-screen items-center justify-center px-4 py-12">
            <div className="w-full max-w-2xl">
                <p className="label-tech">Emergency response simulation</p>
                <h1 className="mt-2 font-display text-5xl font-bold uppercase tracking-tight sm:text-6xl">
                    Criscris
                </h1>
                <p className="mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
                    An interactive world-model simulation that trains and scores emergency decision-making
                    under escalating hazard conditions.
                </p>

                <article className="mt-8 rounded border border-border bg-surface p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
                            Warehouse Fire — Simulation 01
                        </h2>
                        <span className="label-tech rounded border border-hazard-high/50 px-2 py-0.5 text-hazard-high">
                            Prototype training simulation
                        </span>
                    </div>

                    <ul className="mt-5 space-y-3">
                        {bullets.map((b) => (
                            <li key={b} className="flex gap-3 text-sm text-muted-foreground sm:text-base">
                                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 bg-primary" />
                                <span>{b}</span>
                            </li>
                        ))}
                    </ul>

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
                        {starting ? "Initialising world…" : "Start Simulation"}
                    </button>

                    <div className="mt-5 border-t border-border pt-4">
                        <button
                            type="button"
                            onClick={() => setShowScoring((v) => !v)}
                            aria-expanded={showScoring}
                            className="label-tech hover:text-foreground"
                        >
                            How scoring works {showScoring ? "−" : "+"}
                        </button>
                        {showScoring && (
                            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                                <p>
                                    Five categories are scored 0–20 each for a total out of 100: situational
                                    awareness, emergency reporting, risk assessment, response time and evacuation
                                    decision.
                                </p>
                                <p>
                                    Scoring is a deterministic prototype heuristic for demonstration only — it is not
                                    a certified safety assessment.
                                </p>
                            </div>
                        )}
                    </div>
                </article>
            </div>
        </main>
    );
}
