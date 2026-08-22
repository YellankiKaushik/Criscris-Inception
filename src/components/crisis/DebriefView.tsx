import { scoreBand, type ScoreBreakdown } from "@/lib/scenario/scoring";
import { ACTION_LABELS, type SimulationState } from "@/lib/scenario/types";
import { cn } from "@/lib/utils";

interface DebriefViewProps {
    state: SimulationState;
    score: ScoreBreakdown;
    onRestart: () => void;
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DebriefView({ state, score, onRestart }: DebriefViewProps) {
    const band = scoreBand(score.total);
    const evacuation = state.actions.find((a) => a.type === "evacuate");

    const categories: { label: string; value: number }[] = [
        { label: "Situational Awareness", value: score.situationalAwareness },
        { label: "Emergency Reporting", value: score.emergencyReporting },
        { label: "Risk Assessment", value: score.riskAssessment },
        { label: "Response Time", value: score.responseTime },
        { label: "Evacuation Decision", value: score.evacuationDecision },
    ];

    return (
        <main className="grid-backdrop min-h-screen px-4 py-10 sm:px-6">
            <div className="mx-auto w-full max-w-4xl">
                <p className="label-tech">Debrief · Warehouse Fire — Simulation 01</p>

                <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4 border-b border-border pb-6">
                    <div>
                        <p className="font-display text-6xl font-bold leading-none sm:text-7xl">
                            {score.total}
                            <span className="text-2xl text-muted-foreground">/100</span>
                        </p>
                        <p
                            className={cn(
                                "mt-2 font-display text-lg font-semibold uppercase tracking-wide",
                                score.total >= 70 ? "text-hazard-low" : score.total >= 50 ? "text-hazard-high" : "text-hazard-critical",
                            )}
                        >
                            {band}
                        </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <div>
                            <dt className="label-tech">Outcome</dt>
                            <dd>{state.completionReason === "evacuated" ? "Evacuated" : "Timed out inside"}</dd>
                        </div>
                        <div>
                            <dt className="label-tech">Response time</dt>
                            <dd>{evacuation ? formatTime(evacuation.timestampSeconds) : "No evacuation"}</dd>
                        </div>
                    </dl>
                </div>

                <section className="mt-8">
                    <h2 className="label-tech">Category scores</h2>
                    <ul className="mt-3 space-y-3">
                        {categories.map((c) => (
                            <li key={c.label}>
                                <div className="flex items-baseline justify-between text-sm">
                                    <span>{c.label}</span>
                                    <span className="font-mono text-muted-foreground">{c.value}/20</span>
                                </div>
                                <div className="mt-1.5 h-1.5 w-full bg-secondary">
                                    <div
                                        className="h-full bg-primary transition-all"
                                        style={{ width: `${(c.value / 20) * 100}%` }}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                <div className="mt-8 grid gap-6 md:grid-cols-2">
                    <section className="rounded border border-border bg-surface p-4">
                        <h2 className="font-display text-base font-semibold uppercase tracking-wide">
                            What you did well
                        </h2>
                        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            {score.positives.length ? (
                                score.positives.map((p) => <li key={p}>— {p}</li>)
                            ) : (
                                <li>— No effective actions were recorded in this run.</li>
                            )}
                        </ul>
                    </section>
                    <section className="rounded border border-border bg-surface p-4">
                        <h2 className="font-display text-base font-semibold uppercase tracking-wide">
                            What to improve
                        </h2>
                        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            {score.improvements.length ? (
                                score.improvements.map((p) => <li key={p}>— {p}</li>)
                            ) : (
                                <li>— Nothing significant to correct in this run.</li>
                            )}
                        </ul>
                    </section>
                </div>

                <section className="mt-8">
                    <h2 className="label-tech">Action timeline</h2>
                    <ol className="mt-3 divide-y divide-border border-y border-border">
                        {state.actions.length === 0 && (
                            <li className="py-3 text-sm text-muted-foreground">No actions were taken.</li>
                        )}
                        {state.actions.map((a) => (
                            <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                                <span className="font-mono text-muted-foreground">
                                    {formatTime(a.timestampSeconds)}
                                </span>
                                <span>{ACTION_LABELS[a.type]}</span>
                                <span className="label-tech">{a.stage}</span>
                            </li>
                        ))}
                    </ol>
                </section>

                <button
                    type="button"
                    onClick={onRestart}
                    className="mt-8 w-full rounded bg-primary px-6 py-3.5 font-display text-base font-semibold uppercase tracking-widest text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
                >
                    Restart Simulation
                </button>

                <p className="label-tech mt-6 normal-case tracking-normal">
                    Prototype training simulation. Scores are heuristic and not a formal safety assessment or
                    certification.
                </p>
            </div>
        </main>
    );
}
