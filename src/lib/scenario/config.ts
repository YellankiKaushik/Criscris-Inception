export interface ScenarioConfig {
  readonly highAtSeconds: number;
  readonly criticalAtSeconds: number;
  readonly hardStopSeconds: number;
}

export const scenarioConfig: ScenarioConfig = {
  highAtSeconds: 35,
  criticalAtSeconds: 75,
  hardStopSeconds: 150,
};

export const demoScenarioConfig: ScenarioConfig = {
  highAtSeconds: 15,
  criticalAtSeconds: 35,
  hardStopSeconds: 75,
};

/** `?demo=1` shortens the timeline for demo recording without changing logic. */
export function resolveScenarioConfig(search?: string): ScenarioConfig {
  if (!search) return scenarioConfig;
  const params = new URLSearchParams(search);
  const demo = params.get("demo");
  return demo === "1" || demo === "true" ? demoScenarioConfig : scenarioConfig;
}
