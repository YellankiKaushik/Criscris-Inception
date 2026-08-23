import { createFileRoute } from "@tanstack/react-router";
import { DebriefView } from "@/components/crisis/DebriefView";
import { ScenarioBriefing } from "@/components/crisis/ScenarioBriefing";
import { SimulationShell } from "@/components/crisis/SimulationShell";
import { useSimulation } from "@/hooks/useSimulation";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Criscris - Warehouse Fire Emergency Response Simulation" },
      {
        name: "description",
        content:
          "Criscris is an interactive world-model simulation that scores emergency decision-making during an escalating industrial warehouse fire.",
      },
      { property: "og:title", content: "Criscris - Emergency Response Simulation" },
      {
        property: "og:description",
        content:
          "Run a warehouse fire scenario, take response actions under escalating hazard, and get a deterministic decision score out of 100.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const simulation = useSimulation();
  const { state, score, recording, start, restart, switchToDemo, providerKind } = simulation;

  if (state.status === "complete" && score) {
    return <DebriefView state={state} score={score} recording={recording} onRestart={restart} />;
  }

  if (state.status === "running" || state.status === "starting") {
    return <SimulationShell {...simulation} />;
  }

  return (
    <ScenarioBriefing
      onStart={start}
      starting={state.status === "starting"}
      error={state.status === "error" ? state.worldError : null}
      providerKind={providerKind}
      onSwitchToDemo={switchToDemo}
    />
  );
}
