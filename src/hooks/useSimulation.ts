import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { resolveScenarioConfig, type ScenarioConfig } from "@/lib/scenario/config";
import { CRITICAL_PROMPT, HIGH_PROMPT, LOW_PROMPT, OBJECTIVES } from "@/lib/scenario/prompts";
import { calculateScore, type ScoreBreakdown } from "@/lib/scenario/scoring";
import type {
    HazardLevel,
    PlayerAction,
    PlayerActionType,
    ScenarioStage,
    SimulationState,
    WorldStatus,
} from "@/lib/scenario/types";
import { createWorldProvider } from "@/lib/world";
import type { WorldMotion, WorldProvider } from "@/lib/world/types";

type Action =
    | { type: "start" }
    | { type: "started" }
    | { type: "tick"; elapsedSeconds: number }
    | { type: "stage"; stage: ScenarioStage; hazardLevel: HazardLevel }
    | { type: "record"; action: PlayerAction }
    | { type: "complete"; reason: "evacuated" | "timeout" }
    | { type: "world"; status: WorldStatus; error: string | null }
    | { type: "reset" };

const initialState: SimulationState = {
    status: "idle",
    stage: "briefing",
    hazardLevel: "LOW",
    elapsedSeconds: 0,
    actions: [],
    startedAt: null,
    completedAt: null,
    completionReason: null,
    worldStatus: "idle",
    worldError: null,
};

function reducer(state: SimulationState, action: Action): SimulationState {
    switch (action.type) {
        case "start":
            return { ...initialState, status: "starting", worldStatus: state.worldStatus };
        case "started":
            return { ...state, status: "running", stage: "low", hazardLevel: "LOW", startedAt: Date.now() };
        case "tick":
            return state.status === "running" ? { ...state, elapsedSeconds: action.elapsedSeconds } : state;
        case "stage":
            return { ...state, stage: action.stage, hazardLevel: action.hazardLevel };
        case "record":
            return { ...state, actions: [...state.actions, action.action] };
        case "complete":
            if (state.status === "complete") return state;
            return {
                ...state,
                status: "complete",
                stage: "complete",
                completedAt: Date.now(),
                completionReason: action.reason,
            };
        case "world":
            return { ...state, worldStatus: action.status, worldError: action.error };
        case "reset":
            return { ...initialState, worldStatus: state.worldStatus };
        default:
            return state;
    }
}

const idleMotion: WorldMotion = {
    longitudinal: "idle",
    lateral: "idle",
    lookHorizontal: "idle",
    lookVertical: "idle",
};

export interface UseSimulationResult {
    state: SimulationState;
    config: ScenarioConfig;
    objective: string;
    motion: WorldMotion;
    providerKind: WorldProvider["kind"];
    score: ScoreBreakdown | null;
    usedActions: Set<PlayerActionType>;
    start: () => void;
    performAction: (type: PlayerActionType) => void;
    restart: () => void;
}

export function useSimulation(): UseSimulationResult {
    const [state, dispatch] = useReducer(reducer, initialState);
    const [motion, setMotion] = useState<WorldMotion>(idleMotion);
    const providerRef = useRef<WorldProvider | null>(null);
    const startRef = useRef<number | null>(null);
    const stageRef = useRef<ScenarioStage>("briefing");

    const config = useMemo(
        () => resolveScenarioConfig(typeof window === "undefined" ? "" : window.location.search),
        [],
    );

    const getProvider = useCallback((): WorldProvider => {
        if (!providerRef.current) providerRef.current = createWorldProvider();
        return providerRef.current;
    }, []);

    // Single provider instance + subscriptions.
    useEffect(() => {
        const provider = getProvider();
        const offStatus = provider.onStatusChange((status, error) =>
            dispatch({ type: "world", status, error }),
        );
        const offMotion = provider.onMotionChange(setMotion);
        return () => {
            offStatus();
            offMotion();
        };
    }, [getProvider]);

    stageRef.current = state.stage;

    const start = useCallback(() => {
        const provider = getProvider();
        dispatch({ type: "start" });
        void (async () => {
            await provider.initialize({ initialPrompt: LOW_PROMPT });
            await provider.start();
            startRef.current = Date.now();
            dispatch({ type: "started" });
        })();
    }, [getProvider]);


    // Single simulation clock.
    useEffect(() => {
        if (state.status !== "running") return;
        const interval = setInterval(() => {
            const started = startRef.current;
            if (started == null) return;
            const elapsed = Math.floor((Date.now() - started) / 1000);
            dispatch({ type: "tick", elapsedSeconds: elapsed });

            const provider = providerRef.current;
            const stage = stageRef.current;
            if (elapsed >= config.hardStopSeconds) {
                dispatch({ type: "complete", reason: "timeout" });
                void provider?.pause();
            } else if (elapsed >= config.criticalAtSeconds && stage !== "critical") {
                dispatch({ type: "stage", stage: "critical", hazardLevel: "CRITICAL" });
                void provider?.setScenarioPrompt(CRITICAL_PROMPT);
            } else if (elapsed >= config.highAtSeconds && stage === "low") {
                dispatch({ type: "stage", stage: "high", hazardLevel: "HIGH" });
                void provider?.setScenarioPrompt(HIGH_PROMPT);
            }
        }, 250);
        return () => clearInterval(interval);
    }, [state.status, config]);

    // Keyboard navigation -> provider movement (key-up resets to idle).
    useEffect(() => {
        if (state.status !== "running") return;
        const provider = providerRef.current;
        if (!provider) return;

        const apply = (key: string, down: boolean) => {
            switch (key.toLowerCase()) {
                case "w":
                    provider.setMoveLongitudinal(down ? "forward" : "idle");
                    return true;
                case "s":
                    provider.setMoveLongitudinal(down ? "back" : "idle");
                    return true;
                case "a":
                    provider.setMoveLateral(down ? "strafe_left" : "idle");
                    return true;
                case "d":
                    provider.setMoveLateral(down ? "strafe_right" : "idle");
                    return true;
                case "arrowleft":
                    provider.setLookHorizontal(down ? "left" : "idle");
                    return true;
                case "arrowright":
                    provider.setLookHorizontal(down ? "right" : "idle");
                    return true;
                case "arrowup":
                    provider.setLookVertical(down ? "up" : "idle");
                    return true;
                case "arrowdown":
                    provider.setLookVertical(down ? "down" : "idle");
                    return true;
                default:
                    return false;
            }
        };

        const onDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            if (apply(e.key, true)) e.preventDefault();
        };
        const onUp = (e: KeyboardEvent) => {
            if (apply(e.key, false)) e.preventDefault();
        };
        const onBlur = () => {
            provider.setMoveLongitudinal("idle");
            provider.setMoveLateral("idle");
            provider.setLookHorizontal("idle");
            provider.setLookVertical("idle");
        };

        window.addEventListener("keydown", onDown);
        window.addEventListener("keyup", onUp);
        window.addEventListener("blur", onBlur);
        return () => {
            window.removeEventListener("keydown", onDown);
            window.removeEventListener("keyup", onUp);
            window.removeEventListener("blur", onBlur);
            onBlur();
        };
    }, [state.status]);

    const usedActions = useMemo(
        () => new Set(state.actions.map((a) => a.type)),
        [state.actions],
    );

    const performAction = useCallback(
        (type: PlayerActionType) => {
            if (state.status !== "running") return;
            if (type !== "evacuate" && usedActions.has(type)) return;
            const started = startRef.current;
            const elapsed = started == null ? 0 : Math.floor((Date.now() - started) / 1000);
            dispatch({
                type: "record",
                action: {
                    id: `${type}-${elapsed}-${Math.random().toString(36).slice(2, 8)}`,
                    type,
                    timestampSeconds: elapsed,
                    stage: state.stage,
                },
            });
            if (type === "evacuate") {
                dispatch({ type: "complete", reason: "evacuated" });
                void providerRef.current?.pause();
            }
        },
        [state.status, state.stage, usedActions],
    );

    const restart = useCallback(() => {
        startRef.current = null;
        void providerRef.current?.reset();
        dispatch({ type: "reset" });
    }, []);

    const objective =
        state.stage === "briefing"
            ? OBJECTIVES.briefing
            : state.stage === "low"
                ? OBJECTIVES.low
                : state.stage === "high"
                    ? OBJECTIVES.high
                    : state.stage === "critical"
                        ? OBJECTIVES.critical
                        : OBJECTIVES.complete;

    const score = state.status === "complete" ? calculateScore(state) : null;

    return {
        state,
        config,
        objective,
        motion,
        providerKind: providerRef.current?.kind ?? "mock",
        score,
        usedActions,
        start,
        performAction,
        restart,
    };
}
