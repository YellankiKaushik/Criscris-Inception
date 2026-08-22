import type { PlayerAction, PlayerActionType, SimulationState } from "./types";

export interface ScoreBreakdown {
    situationalAwareness: number;
    emergencyReporting: number;
    riskAssessment: number;
    responseTime: number;
    evacuationDecision: number;
    total: number;
    positives: string[];
    improvements: string[];
}

export type ScoreBand = "Strong Response" | "Effective Response" | "Needs Improvement" | "High-Risk Response";

export function scoreBand(total: number): ScoreBand {
    if (total >= 85) return "Strong Response";
    if (total >= 70) return "Effective Response";
    if (total >= 50) return "Needs Improvement";
    return "High-Risk Response";
}

function find(actions: PlayerAction[], type: PlayerActionType): PlayerAction | undefined {
    return actions.find((a) => a.type === type);
}

export function calculateScore(state: SimulationState): ScoreBreakdown {
    const positives: string[] = [];
    const improvements: string[] = [];

    const report = find(state.actions, "report_emergency");
    const search = find(state.actions, "search_workers");
    const fireControl = find(state.actions, "attempt_fire_control");
    const evacuate = find(state.actions, "evacuate");

    // Situational Awareness — 20
    let situationalAwareness = 0;
    if (search && search.stage !== "critical") {
        situationalAwareness += 10;
        positives.push("You checked nearby aisles for personnel before conditions became critical.");
    } else {
        improvements.push("Sweep for remaining personnel earlier, while visibility still allows it.");
    }
    if (report && report.stage !== "critical") {
        situationalAwareness += 10;
    }

    // Emergency Reporting — 20
    let emergencyReporting = 0;
    if (report) {
        if (report.timestampSeconds <= 45) {
            emergencyReporting = 20;
            positives.push("You reported the emergency early, preserving response time.");
        } else if (report.timestampSeconds <= 75) {
            emergencyReporting = 15;
            positives.push("You reported the emergency, though slightly later than ideal.");
        } else {
            emergencyReporting = 8;
            improvements.push("You reported the emergency late; reporting should happen within the first minute.");
        }
    } else {
        improvements.push("You never reported the emergency to the site response team.");
    }

    // Risk Assessment — 20
    let riskAssessment = 20;
    if (fireControl) {
        if (fireControl.stage === "low") {
            riskAssessment -= 3;
            positives.push("Any suppression attempt was made while the fire was still small.");
        } else if (fireControl.stage === "high") {
            riskAssessment -= 8;
            improvements.push("You attempted direct fire control after conditions had already escalated.");
        } else {
            riskAssessment -= 15;
            improvements.push("You attempted direct fire control after the scenario reached critical conditions.");
        }
    } else {
        positives.push("You avoided unnecessary direct engagement with the fire.");
    }
    riskAssessment = Math.max(0, riskAssessment);

    // Response Time — 20
    let responseTime = 0;
    if (evacuate) {
        const t = evacuate.timestampSeconds;
        if (t <= 90) responseTime = 20;
        else if (t <= 120) responseTime = 15;
        else if (t <= 150) responseTime = 8;
        else responseTime = 8;
    }

    // Evacuation Decision — 20
    let evacuationDecision = 0;
    if (evacuate) {
        if (evacuate.stage === "high") {
            evacuationDecision = 20;
            positives.push("You evacuated while conditions were deteriorating but still survivable.");
        } else if (evacuate.stage === "critical") {
            evacuationDecision = 15;
            improvements.push("You waited until critical conditions before evacuating.");
        } else {
            evacuationDecision = 12;
            improvements.push("You evacuated very early, before assessing the situation fully.");
        }
    } else {
        improvements.push("You never evacuated; the scenario ended with you still inside the building.");
    }

    const total =
        situationalAwareness + emergencyReporting + riskAssessment + responseTime + evacuationDecision;

    return {
        situationalAwareness,
        emergencyReporting,
        riskAssessment,
        responseTime,
        evacuationDecision,
        total,
        positives,
        improvements,
    };
}
