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
import { createWorldProvider, resolveProviderKind } from "@/lib/world";
import type { WorldMotion, WorldProvider, WorldProviderKind } from "@/lib/world";

type Action =
  | { type: "start" }
  | { type: "started" }
  | { type: "tick"; elapsedSeconds: number }
  | { type: "stage"; stage: ScenarioStage; hazardLevel: HazardLevel }
  | { type: "record"; action: PlayerAction }
  | { type: "complete"; reason: "evacuated" | "timeout" }
  | { type: "world"; status: WorldStatus; error: string | null }
  | { type: "fail"; error: string }
  | { type: "reset" };

const STAGE_ORDER: Record<ScenarioStage, number> = {
  briefing: 0,
  low: 1,
  high: 2,
  critical: 3,
  complete: 4,
};

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
      return { ...initialState, status: "starting" };
    case "started":
      return {
        ...state,
        status: "running",
        stage: "low",
        hazardLevel: "LOW",
        startedAt: Date.now(),
      };
    case "tick":
      return state.status === "running"
        ? { ...state, elapsedSeconds: action.elapsedSeconds }
        : state;
    case "stage":
      if (STAGE_ORDER[action.stage] < STAGE_ORDER[state.stage]) return state;
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
    case "fail":
      return {
        ...state,
        status: "error",
        worldStatus: "error",
        worldError: action.error,
      };
    case "reset":
      return { ...initialState };
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
  videoStream: MediaStream | null;
  providerKind: WorldProviderKind;
  score: ScoreBreakdown | null;
  usedActions: Set<PlayerActionType>;
  start: () => void;
  performAction: (type: PlayerActionType) => void;
  restart: () => void;
  switchToDemo: () => void;
}

export function useSimulation(): UseSimulationResult {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [motion, setMotion] = useState<WorldMotion>(idleMotion);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [providerKind, setProviderKind] = useState<WorldProviderKind>(() => resolveProviderKind());
  const providerRef = useRef<WorldProvider | null>(null);
  const startRef = useRef<number | null>(null);
  const stageRef = useRef<ScenarioStage>("briefing");
  const startLockRef = useRef(false);
  const generationRef = useRef(0);

  const config = useMemo(
    () => resolveScenarioConfig(typeof window === "undefined" ? "" : window.location.search),
    [],
  );

  const attachProvider = useCallback((provider: WorldProvider) => {
    providerRef.current = provider;
    setProviderKind(provider.kind);
    const offStatus = provider.onStatusChange((status, error) =>
      dispatch({ type: "world", status, error }),
    );
    const offMotion = provider.onMotionChange(setMotion);
    const offVideo = provider.onVideoStream(setVideoStream);
    return () => {
      offStatus();
      offMotion();
      offVideo();
    };
  }, []);

  useEffect(() => {
    const provider = createWorldProvider();
    const detach = attachProvider(provider);
    return () => {
      detach();
      void providerRef.current?.dispose();
      providerRef.current = null;
    };
  }, [attachProvider]);

  stageRef.current = state.stage;

  const start = useCallback(() => {
    const provider = providerRef.current;
    if (!provider || startLockRef.current) return;
    startLockRef.current = true;
    const generation = ++generationRef.current;
    dispatch({ type: "start" });
    void (async () => {
      try {
        await provider.initialize({ initialPrompt: LOW_PROMPT });
        if (generation !== generationRef.current) return;
        await provider.start();
        if (generation !== generationRef.current) return;
        startRef.current = Date.now();
        dispatch({ type: "started" });
      } catch (error) {
        if (generation !== generationRef.current) return;
        const message =
          error instanceof Error ? error.message : "Unable to start the simulation world.";
        dispatch({ type: "fail", error: message });
      } finally {
        if (generation === generationRef.current) startLockRef.current = false;
      }
    })();
  }, []);

  useEffect(() => {
    if (state.status !== "running") return;
    const interval = setInterval(() => {
      const started = startRef.current;
      if (started == null) return;
      const elapsed = Math.floor((Date.now() - started) / 1000);
      dispatch({ type: "tick", elapsedSeconds: elapsed });

      const provider = providerRef.current;
      const stage = stageRef.current;
      if (stage === "complete") return;

      if (elapsed >= config.hardStopSeconds) {
        stageRef.current = "complete";
        dispatch({ type: "complete", reason: "timeout" });
        void provider?.pause();
      } else if (elapsed >= config.criticalAtSeconds && STAGE_ORDER[stage] < STAGE_ORDER.critical) {
        stageRef.current = "critical";
        dispatch({ type: "stage", stage: "critical", hazardLevel: "CRITICAL" });
        void provider?.setScenarioPrompt(CRITICAL_PROMPT);
      } else if (elapsed >= config.highAtSeconds && STAGE_ORDER[stage] < STAGE_ORDER.high) {
        stageRef.current = "high";
        dispatch({ type: "stage", stage: "high", hazardLevel: "HIGH" });
        void provider?.setScenarioPrompt(HIGH_PROMPT);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [state.status, config]);

  useEffect(() => {
    if (state.status !== "running") return;
    const provider = providerRef.current;
    if (!provider) return;

    const apply = (key: string, down: boolean) => {
      switch (key.toLowerCase()) {
        case "w":
          void provider.setMoveLongitudinal(down ? "forward" : "idle");
          return true;
        case "s":
          void provider.setMoveLongitudinal(down ? "back" : "idle");
          return true;
        case "a":
          void provider.setMoveLateral(down ? "strafe_left" : "idle");
          return true;
        case "d":
          void provider.setMoveLateral(down ? "strafe_right" : "idle");
          return true;
        case "arrowleft":
          void provider.setLookHorizontal(down ? "left" : "idle");
          return true;
        case "arrowright":
          void provider.setLookHorizontal(down ? "right" : "idle");
          return true;
        case "arrowup":
          void provider.setLookVertical(down ? "up" : "idle");
          return true;
        case "arrowdown":
          void provider.setLookVertical(down ? "down" : "idle");
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
      void provider.setMoveLongitudinal("idle");
      void provider.setMoveLateral("idle");
      void provider.setLookHorizontal("idle");
      void provider.setLookVertical("idle");
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

  const usedActions = useMemo(() => new Set(state.actions.map((a) => a.type)), [state.actions]);

  const performAction = useCallback(
    (type: PlayerActionType) => {
      if (state.status !== "running") return;
      if (type !== "evacuate" && usedActions.has(type)) return;
      if (type === "evacuate" && usedActions.has("evacuate")) return;
      const started = startRef.current;
      const elapsed = started == null ? 0 : Math.floor((Date.now() - started) / 1000);
      dispatch({
        type: "record",
        action: {
          id: `${type}-${elapsed}-${crypto.randomUUID()}`,
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
    generationRef.current += 1;
    startLockRef.current = false;
    startRef.current = null;
    stageRef.current = "briefing";
    void providerRef.current?.reset();
    dispatch({ type: "reset" });
  }, []);

  const switchToDemo = useCallback(() => {
    generationRef.current += 1;
    startLockRef.current = false;
    startRef.current = null;
    stageRef.current = "briefing";
    const previous = providerRef.current;
    void previous?.dispose();
    const next = createWorldProvider("mock");
    attachProvider(next);
    dispatch({ type: "reset" });
  }, [attachProvider]);

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
    videoStream,
    providerKind,
    score,
    usedActions,
    start,
    performAction,
    restart,
    switchToDemo,
  };
}
