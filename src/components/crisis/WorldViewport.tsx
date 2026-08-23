import { useEffect, useRef, useState } from "react";
import type { HazardLevel, WorldStatus } from "@/lib/scenario/types";
import type { WorldMotion } from "@/lib/world/types";
import { cn } from "@/lib/utils";

interface WorldViewportProps {
  hazardLevel: HazardLevel;
  worldStatus: WorldStatus;
  motion: WorldMotion;
  providerKind: "mock" | "reactor";
  isRunning: boolean;
  videoStream: MediaStream | null;
  startupMessage?: string | null;
  worldError: string | null;
  onRetryLiveWorld?: () => void;
  onSwitchToDemo?: () => void;
}

const smokeOpacity: Record<HazardLevel, string> = {
  LOW: "opacity-25",
  HIGH: "opacity-60",
  CRITICAL: "opacity-85",
};

interface DemoCamera {
  x: number;
  y: number;
  zoom: number;
  yaw: number;
}

const initialDemoCamera: DemoCamera = {
  x: 0,
  y: 0,
  zoom: 1.08,
  yaw: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function WorldViewport({
  hazardLevel,
  worldStatus,
  motion,
  providerKind,
  isRunning,
  videoStream,
  startupMessage,
  worldError,
  onRetryLiveWorld,
  onSwitchToDemo,
}: WorldViewportProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const motionRef = useRef(motion);
  const cameraRef = useRef<DemoCamera>(initialDemoCamera);
  const [demoCamera, setDemoCamera] = useState<DemoCamera>(initialDemoCamera);
  const reactorLive = providerKind === "reactor";

  useEffect(() => {
    motionRef.current = motion;
  }, [motion]);

  useEffect(() => {
    if (providerKind !== "mock") return;
    cameraRef.current = initialDemoCamera;
    setDemoCamera(initialDemoCamera);
  }, [providerKind]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    let playAttempted = false;

    const attemptPlay = () => {
      if (!videoStream || playAttempted) return;
      playAttempted = true;
      void el.play().catch(() => {
        playAttempted = false;
      });
    };

    el.srcObject = videoStream;
    if (videoStream) {
      attemptPlay();
      el.addEventListener("loadedmetadata", attemptPlay);
      el.addEventListener("canplay", attemptPlay);
    }
    return () => {
      el.removeEventListener("loadedmetadata", attemptPlay);
      el.removeEventListener("canplay", attemptPlay);
      if (el.srcObject === videoStream) {
        el.srcObject = null;
      }
    };
  }, [videoStream]);

  const moving =
    motion.longitudinal !== "idle" ||
    motion.lateral !== "idle" ||
    motion.lookHorizontal !== "idle" ||
    motion.lookVertical !== "idle";

  useEffect(() => {
    if (providerKind !== "mock" || !isRunning) return;

    let frameId = 0;
    let lastTime = performance.now();

    const step = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const currentMotion = motionRef.current;
      const active =
        currentMotion.longitudinal !== "idle" ||
        currentMotion.lateral !== "idle" ||
        currentMotion.lookHorizontal !== "idle" ||
        currentMotion.lookVertical !== "idle";

      if (active) {
        const next = { ...cameraRef.current };

        if (currentMotion.longitudinal === "forward") next.zoom += 0.2 * dt;
        if (currentMotion.longitudinal === "back") next.zoom -= 0.18 * dt;
        if (currentMotion.lateral === "strafe_left") next.x += 10 * dt;
        if (currentMotion.lateral === "strafe_right") next.x -= 10 * dt;
        if (currentMotion.lookHorizontal === "left") {
          next.x += 14 * dt;
          next.yaw -= 2.8 * dt;
        }
        if (currentMotion.lookHorizontal === "right") {
          next.x -= 14 * dt;
          next.yaw += 2.8 * dt;
        }
        if (currentMotion.lookVertical === "up") next.y += 9 * dt;
        if (currentMotion.lookVertical === "down") next.y -= 9 * dt;

        next.x = clamp(next.x, -12, 12);
        next.y = clamp(next.y, -8, 8);
        next.zoom = clamp(next.zoom, 1.05, 1.35);
        next.yaw = clamp(next.yaw, -3, 3);

        cameraRef.current = next;
        setDemoCamera(next);
      }

      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [providerKind, isRunning]);

  const demoTransform = `translate3d(${demoCamera.x}%, ${demoCamera.y}%, 0) scale(${demoCamera.zoom}) rotate(${demoCamera.yaw}deg)`;

  const overlayLoading =
    worldStatus === "connecting" ||
    worldStatus === "idle" ||
    (reactorLive && !videoStream && worldStatus !== "error" && worldStatus !== "paused");

  return (
    <div className="relative h-full min-h-[46vh] w-full overflow-hidden bg-black sm:min-h-[58vh]">
      {reactorLive ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          playsInline
          muted
          controls={false}
        />
      ) : (
        <div
          className={cn(
            "absolute inset-0 transition-transform duration-100 ease-out will-change-transform",
            !moving && isRunning && "animate-camera-breathe",
          )}
          style={{ transform: demoTransform }}
        >
          <img
            src="/warehouse-seed.jpg"
            alt="First-person view of an industrial warehouse aisle during a fire emergency simulation"
            width={1536}
            height={896}
            className={cn(
              "h-full w-full scale-105 object-cover transition-all duration-1000",
              hazardLevel === "HIGH" && "brightness-90 contrast-105 saturate-75",
              hazardLevel === "CRITICAL" && "brightness-[0.7] contrast-110 saturate-50",
            )}
          />
        </div>
      )}

      {!reactorLive && (
        <>
          <div
            className={cn(
              "pointer-events-none absolute -inset-10 animate-drift-smoke transition-opacity duration-1000",
              smokeOpacity[hazardLevel],
            )}
            style={{
              background:
                "radial-gradient(60% 55% at 68% 45%, oklch(0.55 0.02 60 / 85%) 0%, oklch(0.4 0.02 60 / 45%) 45%, transparent 75%)",
              filter: "blur(18px)",
            }}
          />
          {hazardLevel !== "LOW" && (
            <div
              className="pointer-events-none absolute inset-0 animate-hazard-pulse"
              style={{
                background:
                  hazardLevel === "CRITICAL"
                    ? "radial-gradient(70% 60% at 50% 30%, var(--hazard-critical) 0%, transparent 70%)"
                    : "radial-gradient(70% 60% at 50% 30%, var(--hazard-high) 0%, transparent 70%)",
                mixBlendMode: "soft-light",
              }}
            />
          )}
        </>
      )}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 80% at 50% 50%, transparent 40%, oklch(0 0 0 / 65%) 100%)",
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3 sm:p-4">
        <span className="label-tech rounded border border-border/70 bg-background/70 px-2 py-1 backdrop-blur">
          {providerKind === "mock" ? "Demo World" : "Reactor World"} | {worldStatus}
        </span>
        <span
          className={cn(
            "label-tech rounded border border-border/70 bg-background/70 px-2 py-1 backdrop-blur transition-opacity",
            moving ? "opacity-100 text-foreground" : "opacity-40",
          )}
        >
          {moving ? "Moving" : "Holding position"}
        </span>
      </div>

      {overlayLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/85">
          <span className="label-tech animate-pulse text-center">
            {startupMessage ??
              (reactorLive ? "Waiting for Reactor video stream..." : "Establishing world link...")}
          </span>
        </div>
      )}

      {worldStatus === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 px-4">
          <div className="max-w-md text-center">
            <p className="font-display text-lg font-semibold uppercase">World unavailable</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {worldError ?? "The generated world could not be started."}
            </p>
            {onSwitchToDemo && providerKind === "reactor" && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {onRetryLiveWorld && (
                  <button
                    type="button"
                    onClick={onRetryLiveWorld}
                    className="rounded bg-primary px-4 py-2 font-display text-sm uppercase tracking-widest text-primary-foreground"
                  >
                    Retry Live World
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSwitchToDemo}
                  className="rounded border border-border px-4 py-2 font-display text-sm uppercase tracking-widest"
                >
                  Switch to Demo Mode
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
