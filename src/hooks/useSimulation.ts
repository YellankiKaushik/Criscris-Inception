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

export interface SimulationRecordingState {
  recordingBlob: Blob | null;
  recordingMimeType: string | null;
  recordingAvailable: boolean;
  recordingError: string | null;
}

const initialRecordingState: SimulationRecordingState = {
  recordingBlob: null,
  recordingMimeType: null,
  recordingAvailable: false,
  recordingError: null,
};

function getSupportedRecordingMimeType(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export interface UseSimulationResult {
  state: SimulationState;
  config: ScenarioConfig;
  objective: string;
  motion: WorldMotion;
  videoStream: MediaStream | null;
  worldProgress: string | null;
  recording: SimulationRecordingState;
  providerKind: WorldProviderKind;
  score: ScoreBreakdown | null;
  usedActions: Set<PlayerActionType>;
  start: () => void;
  performAction: (type: PlayerActionType) => void;
  retryLiveWorld: () => void;
  restart: () => void;
  switchToDemo: () => void;
}

export function useSimulation(): UseSimulationResult {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [motion, setMotion] = useState<WorldMotion>(idleMotion);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [worldProgress, setWorldProgress] = useState<string | null>(null);
  const [recording, setRecording] = useState<SimulationRecordingState>(initialRecordingState);
  const [providerKind, setProviderKind] = useState<WorldProviderKind>(() => resolveProviderKind());
  const providerRef = useRef<WorldProvider | null>(null);
  const providerDetachRef = useRef<(() => void) | null>(null);
  const startRef = useRef<number | null>(null);
  const stageRef = useRef<ScenarioStage>("briefing");
  const startLockRef = useRef(false);
  const generationRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingGenerationRef = useRef(0);

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
    let offProgress = () => {};
    if (provider.onProgressChange) {
      offProgress = provider.onProgressChange(setWorldProgress);
    } else {
      setWorldProgress(null);
    }
    return () => {
      offStatus();
      offMotion();
      offVideo();
      offProgress();
    };
  }, []);

  const replaceProvider = useCallback(
    async (kind: WorldProviderKind): Promise<WorldProvider> => {
      const previous = providerRef.current;
      providerDetachRef.current?.();
      providerDetachRef.current = null;
      providerRef.current = null;
      setVideoStream(null);
      setMotion(idleMotion);
      setWorldProgress(null);
      await previous?.dispose();

      const next = createWorldProvider(kind);
      providerDetachRef.current = attachProvider(next);
      return next;
    },
    [attachProvider],
  );

  useEffect(() => {
    const provider = createWorldProvider();
    providerDetachRef.current = attachProvider(provider);
    return () => {
      const current = providerRef.current;
      providerDetachRef.current?.();
      providerDetachRef.current = null;
      providerRef.current = null;
      void current?.dispose();
    };
  }, [attachProvider]);

  stageRef.current = state.stage;

  const stopRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    try {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    } catch {
      setRecording((current) => ({
        ...current,
        recordingError: "Recording unavailable",
      }));
    }
  }, []);

  const clearRecording = useCallback(() => {
    recordingGenerationRef.current += 1;
    stopRecorder();
    recordingChunksRef.current = [];
    recorderRef.current = null;
    setRecording(initialRecordingState);
  }, [stopRecorder]);

  const runStart = useCallback(
    (provider: WorldProvider) => {
      clearRecording();
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
    },
    [clearRecording],
  );

  const start = useCallback(() => {
    const provider = providerRef.current;
    if (!provider || startLockRef.current) return;
    runStart(provider);
  }, [runStart]);

  useEffect(() => {
    if (state.status !== "running" || !videoStream || recorderRef.current) return;
    if (typeof MediaRecorder === "undefined") {
      setRecording({
        recordingBlob: null,
        recordingMimeType: null,
        recordingAvailable: false,
        recordingError: "Recording unavailable: MediaRecorder is not supported in this browser.",
      });
      return;
    }

    const mimeType = getSupportedRecordingMimeType();
    const options = mimeType ? { mimeType } : undefined;
    const recordingGeneration = recordingGenerationRef.current;
    recordingChunksRef.current = [];

    try {
      const recorder = new MediaRecorder(videoStream, options);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        if (recordingGeneration !== recordingGenerationRef.current) return;
        setRecording((current) => ({
          ...current,
          recordingAvailable: false,
          recordingError: "Recording unavailable",
        }));
      };

      recorder.onstop = () => {
        if (recordingGeneration !== recordingGenerationRef.current) return;
        const chunks = recordingChunksRef.current;
        const finalMimeType = recorder.mimeType || mimeType || "video/webm";
        recordingChunksRef.current = [];
        if (chunks.length === 0) {
          setRecording({
            recordingBlob: null,
            recordingMimeType: finalMimeType,
            recordingAvailable: false,
            recordingError: "Recording unavailable",
          });
          return;
        }
        setRecording({
          recordingBlob: new Blob(chunks, { type: finalMimeType }),
          recordingMimeType: finalMimeType,
          recordingAvailable: true,
          recordingError: null,
        });
      };

      recorder.start(1000);
      setRecording({
        recordingBlob: null,
        recordingMimeType: recorder.mimeType || mimeType || "video/webm",
        recordingAvailable: false,
        recordingError: null,
      });
    } catch {
      recorderRef.current = null;
      recordingChunksRef.current = [];
      setRecording({
        recordingBlob: null,
        recordingMimeType: mimeType || null,
        recordingAvailable: false,
        recordingError: "Recording unavailable",
      });
    }
  }, [state.status, videoStream]);

  useEffect(() => {
    if (state.status === "complete" || state.status === "error") {
      stopRecorder();
    }
  }, [state.status, stopRecorder]);

  useEffect(() => {
    return () => {
      recordingGenerationRef.current += 1;
      stopRecorder();
    };
  }, [stopRecorder]);

  useEffect(() => {
    if (state.status !== "complete" || providerKind !== "mock") return;
    setRecording((current) =>
      current.recordingAvailable || current.recordingError
        ? current
        : {
            ...current,
            recordingError: "Recording is available for Live Reactor sessions.",
          },
    );
  }, [state.status, providerKind]);

  useEffect(() => {
    if (state.status !== "running" || providerKind !== "reactor" || !videoStream) return;
    const generation = generationRef.current;
    const tracks = videoStream.getVideoTracks();

    const onEnded = () => {
      if (generation !== generationRef.current) return;
      void providerRef.current?.pause();
      dispatch({
        type: "fail",
        error: "The live world video stream ended. Retry Live World or switch to Demo Mode.",
      });
    };

    if (tracks.some((track) => track.readyState === "ended")) {
      onEnded();
      return;
    }

    for (const track of tracks) {
      track.addEventListener("ended", onEnded);
    }
    return () => {
      for (const track of tracks) {
        track.removeEventListener("ended", onEnded);
      }
    };
  }, [state.status, providerKind, videoStream]);

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
    clearRecording();
    void providerRef.current?.reset();
    dispatch({ type: "reset" });
  }, [clearRecording]);

  const retryLiveWorld = useCallback(() => {
    if (startLockRef.current) return;
    const generation = ++generationRef.current;
    startLockRef.current = true;
    startRef.current = null;
    stageRef.current = "briefing";
    clearRecording();
    void (async () => {
      try {
        const next = await replaceProvider("reactor");
        if (generation !== generationRef.current) return;
        startLockRef.current = false;
        runStart(next);
      } catch {
        if (generation !== generationRef.current) return;
        startLockRef.current = false;
        dispatch({
          type: "fail",
          error: "Unable to retry the live world. Switch to Demo Mode to continue.",
        });
      }
    })();
  }, [clearRecording, replaceProvider, runStart]);

  const switchToDemo = useCallback(() => {
    if (startLockRef.current) return;
    const generation = ++generationRef.current;
    startLockRef.current = true;
    startRef.current = null;
    stageRef.current = "briefing";
    clearRecording();
    void (async () => {
      try {
        const next = await replaceProvider("mock");
        if (generation !== generationRef.current) return;
        startLockRef.current = false;
        runStart(next);
      } catch {
        if (generation !== generationRef.current) return;
        startLockRef.current = false;
        dispatch({
          type: "fail",
          error: "Unable to start Demo Mode. Please restart the simulation.",
        });
      }
    })();
  }, [clearRecording, replaceProvider, runStart]);

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
    worldProgress,
    recording,
    providerKind,
    score,
    usedActions,
    start,
    performAction,
    retryLiveWorld,
    restart,
    switchToDemo,
  };
}
