export type ScenarioStage = "briefing" | "low" | "high" | "critical" | "complete";

export type HazardLevel = "LOW" | "HIGH" | "CRITICAL";

export type PlayerActionType =
    | "report_emergency"
    | "search_workers"
    | "attempt_fire_control"
    | "evacuate";

export interface PlayerAction {
    id: string;
    type: PlayerActionType;
    timestampSeconds: number;
    stage: ScenarioStage;
}

export type WorldStatus = "idle" | "connecting" | "ready" | "generating" | "paused" | "error";

export interface SimulationState {
    status: "idle" | "starting" | "running" | "complete" | "error";
    stage: ScenarioStage;
    hazardLevel: HazardLevel;
    elapsedSeconds: number;
    actions: PlayerAction[];
    startedAt: number | null;
    completedAt: number | null;
    completionReason: "evacuated" | "timeout" | null;
    worldStatus: WorldStatus;
    worldError: string | null;
}

export const ACTION_LABELS: Record<PlayerActionType, string> = {
    report_emergency: "Report",
    search_workers: "Search",
    attempt_fire_control: "Control Fire",
    evacuate: "Evacuate",
};

export const ACTION_DESCRIPTIONS: Record<PlayerActionType, string> = {
    report_emergency: "Radio the emergency to the site fire response team",
    search_workers: "Sweep nearby aisles for remaining personnel",
    attempt_fire_control: "Attempt direct suppression with on-site equipment",
    evacuate: "Leave the building via the nearest safe exit",
};
