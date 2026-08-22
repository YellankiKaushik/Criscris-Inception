import { useMemo } from "react";
import type { HazardLevel, WorldStatus } from "@/lib/scenario/types";
import type { WorldMotion } from "@/lib/world/types";
import { cn } from "@/lib/utils";

interface WorldViewportProps {
    hazardLevel: HazardLevel;
    worldStatus: WorldStatus;
    motion: WorldMotion;
    providerKind: "mock" | "reactor";
    isRunning: boolean;
}

const smokeOpacity: Record<HazardLevel, string> = {
    LOW: "opacity-25",
    HIGH: "opacity-60",
    CRITICAL: "opacity-85",
};

export function WorldViewport({
    hazardLevel,
    worldStatus,
    motion,
    providerKind,
    isRunning,
}: WorldViewportProps) {
    const transform = useMemo(() => {
        const parts: string[] = [];
        if (motion.longitudinal === "forward") parts.push("scale(1.1)");
        if (motion.longitudinal === "back") parts.push("scale(1.01)");
        if (motion.lateral === "strafe_left") parts.push("translateX(2.5%)");
        if (motion.lateral === "strafe_right") parts.push("translateX(-2.5%)");
        if (motion.lookHorizontal === "left") parts.push("translateX(4%) rotate(-0.6deg)");
        if (motion.lookHorizontal === "right") parts.push("translateX(-4%) rotate(0.6deg)");
        if (motion.lookVertical === "up") parts.push("translateY(3%)");
        if (motion.lookVertical === "down") parts.push("translateY(-3%)");
        return parts.length ? parts.join(" ") : undefined;
    }, [motion]);

    const moving =
        motion.longitudinal !== "idle" ||
        motion.lateral !== "idle" ||
        motion.lookHorizontal !== "idle" ||
        motion.lookVertical !== "idle";

    return (
        <div className="relative h-full w-full overflow-hidden bg-black">
            <div
                className={cn(
                    "absolute inset-0 transition-transform duration-500 ease-out",
                    !moving && isRunning && "animate-camera-breathe",
                )}
                style={transform ? { transform } : undefined}
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

            {/* Smoke / fog layer intensifying with hazard */}
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

            {/* Emergency warning light */}
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

            {/* Vignette */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        "radial-gradient(80% 80% at 50% 50%, transparent 40%, oklch(0 0 0 / 65%) 100%)",
                }}
            />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3 sm:p-4">
                <span className="label-tech rounded border border-border/70 bg-background/70 px-2 py-1 backdrop-blur">
                    {providerKind === "mock" ? "Demo World" : "Reactor World"} · {worldStatus}
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

            {(worldStatus === "connecting" || worldStatus === "idle") && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/85">
                    <span className="label-tech animate-pulse">Establishing world link…</span>
                </div>
            )}
        </div>
    );
}
