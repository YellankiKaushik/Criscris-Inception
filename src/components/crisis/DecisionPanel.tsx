import { ACTION_DESCRIPTIONS, ACTION_LABELS, type PlayerActionType } from "@/lib/scenario/types";
import { cn } from "@/lib/utils";

interface DecisionPanelProps {
    objective: string;
    usedActions: Set<PlayerActionType>;
    disabled: boolean;
    onAction: (type: PlayerActionType) => void;
}

const order: PlayerActionType[] = [
    "report_emergency",
    "search_workers",
    "attempt_fire_control",
    "evacuate",
];

export function DecisionPanel({ objective, usedActions, disabled, onAction }: DecisionPanelProps) {
    return (
        <section className="border-t border-border bg-surface">
            <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
                <p className="label-tech">Objective</p>
                <p className="mt-1 text-base text-foreground sm:text-lg">{objective}</p>

                <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {order.map((type) => {
                        const used = usedActions.has(type);
                        const isEvacuate = type === "evacuate";
                        const isDisabled = disabled || (used && !isEvacuate);
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => onAction(type)}
                                disabled={isDisabled}
                                aria-label={`${ACTION_LABELS[type]} — ${ACTION_DESCRIPTIONS[type]}`}
                                className={cn(
                                    "group flex min-h-20 flex-col justify-between rounded border px-3 py-2.5 text-left transition-colors",
                                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                                    isEvacuate
                                        ? "border-primary/70 bg-primary/15 hover:bg-primary/25"
                                        : "border-border bg-surface-raised hover:border-accent/60 hover:bg-secondary",
                                    isDisabled && "cursor-not-allowed opacity-45 hover:bg-surface-raised",
                                )}
                            >
                                <span
                                    className={cn(
                                        "font-display text-sm font-semibold uppercase tracking-wider",
                                        isEvacuate ? "text-primary" : "text-foreground",
                                    )}
                                >
                                    {ACTION_LABELS[type]}
                                </span>
                                <span className="label-tech normal-case tracking-normal">
                                    {used && !isEvacuate ? "Completed" : ACTION_DESCRIPTIONS[type]}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <p className="label-tech mt-3">
                    Navigate: W / A / S / D to move · Arrow keys to look
                </p>
            </div>
        </section>
    );
}
