import { createFileRoute } from "@tanstack/react-router";
import { DebriefView } from "@/components/crisis/DebriefView";
import { ScenarioBriefing } from "@/components/crisis/ScenarioBriefing";
import { SimulationShell } from "@/components/crisis/SimulationShell";
import { useSimulation } from "@/hooks/useSimulation";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Criscris — Emergency Response Simulation" },
      {
        name: "description",
        content: "Interactive emergency-response simulation powered by real-time world models.",
      },
      { name: "author", content: "Kaushik Yellanki" },
      { property: "og:title", content: "Criscris — Emergency Response Simulation" },
      {
        property: "og:description",
        content: "Interactive emergency-response simulation powered by real-time world models.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const simulation = useSimulation();
  const { state, score, recording, start, retryLiveWorld, restart, switchToDemo, providerKind } =
    simulation;
  const primaryStart =
    state.status === "error" && providerKind === "reactor" ? retryLiveWorld : start;

  if (state.status === "complete" && score) {
    return <DebriefView state={state} score={score} recording={recording} onRestart={restart} />;
  }

  if (state.status === "running" || state.status === "starting") {
    return <SimulationShell {...simulation} />;
  }

  return (
    <ScenarioBriefing
      onStart={primaryStart}
      starting={state.status === "starting"}
      error={state.status === "error" ? state.worldError : null}
      providerKind={providerKind}
      onRetryLiveWorld={retryLiveWorld}
      onSwitchToDemo={switchToDemo}
    />
  );
}
