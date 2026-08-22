import { DecisionPanel } from "./DecisionPanel";
import { WorldViewport } from "./WorldViewport";
import type { UseSimulationResult } from "@/hooks/useSimulation";
import { cn } from "@/lib/utils";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SimulationShell({
  state,
  objective,
  motion,
  videoStream,
  providerKind,
  usedActions,
  performAction,
  switchToDemo,
}: UseSimulationResult) {
  const hazardClass =
    state.hazardLevel === "CRITICAL"
      ? "border-hazard-critical/60 text-hazard-critical"
      : state.hazardLevel === "HIGH"
        ? "border-hazard-high/60 text-hazard-high"
        : "border-hazard-low/60 text-hazard-low";

  const connected = state.worldStatus === "ready" || state.worldStatus === "generating";

  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <span className="font-display text-lg font-bold uppercase tracking-[0.2em]">
            Criscris
          </span>
          <span className="font-mono text-lg tabular-nums">{formatTime(state.elapsedSeconds)}</span>
          <span
            className={cn(
              "label-tech rounded border px-2 py-1",
              hazardClass,
              state.hazardLevel === "CRITICAL" && "animate-pulse",
            )}
          >
            Hazard: {state.hazardLevel}
          </span>
          <span className="label-tech ml-auto flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 rounded-full",
                connected
                  ? "bg-hazard-low"
                  : state.worldStatus === "error"
                    ? "bg-hazard-critical"
                    : "bg-muted-foreground",
              )}
            />
            World: {connected ? "Connected" : state.worldStatus}
          </span>
        </div>
      </header>

      <div className="flex flex-1 bg-black">
        <div className="mx-auto h-full min-h-[46vh] w-full max-w-6xl">
          <WorldViewport
            hazardLevel={state.hazardLevel}
            worldStatus={state.worldStatus}
            motion={motion}
            providerKind={providerKind}
            isRunning={state.status === "running"}
            videoStream={videoStream}
            worldError={state.worldError}
            onSwitchToDemo={switchToDemo}
          />
        </div>
      </div>

      <DecisionPanel
        objective={objective}
        usedActions={usedActions}
        disabled={state.status !== "running"}
        onAction={performAction}
      />
    </main>
  );
}
