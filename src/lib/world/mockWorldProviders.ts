import type {
    HorizontalLook,
    LateralMovement,
    LongitudinalMovement,
    VerticalLook,
    WorldMotion,
    WorldProvider,
    WorldStatus,
} from "./types";

/**
 * Fully usable local world provider. Never calls Reactor and never throws.
 * The viewport renders the local seed asset plus hazard-driven effects.
 */
export class MockWorldProvider implements WorldProvider {
    readonly kind = "mock" as const;

    private status: WorldStatus = "idle";
    private error: string | null = null;
    private prompt = "";
    private motion: WorldMotion = {
        longitudinal: "idle",
        lateral: "idle",
        lookHorizontal: "idle",
        lookVertical: "idle",
    };

    private statusListeners = new Set<(status: WorldStatus, error: string | null) => void>();
    private motionListeners = new Set<(motion: WorldMotion) => void>();
    private timers: ReturnType<typeof setTimeout>[] = [];

    private setStatus(status: WorldStatus, error: string | null = null) {
        this.status = status;
        this.error = error;
        for (const l of this.statusListeners) l(status, error);
    }

    private emitMotion() {
        for (const l of this.motionListeners) l({ ...this.motion });
    }

    private delay(ms: number, fn: () => void) {
        this.timers.push(setTimeout(fn, ms));
    }

    getStatus(): WorldStatus {
        return this.status;
    }

    getError(): string | null {
        return this.error;
    }

    async initialize(input: { initialPrompt: string; seedImage?: Blob }): Promise<void> {
        this.prompt = input.initialPrompt;
        this.setStatus("connecting");
        await new Promise<void>((resolve) => this.delay(600, resolve));
        this.setStatus("ready");
    }

    async start(): Promise<void> {
        this.setStatus("generating");
    }

    async setScenarioPrompt(prompt: string): Promise<void> {
        this.prompt = prompt;
        if (this.status === "generating" || this.status === "ready") {
            this.setStatus("generating");
        }
    }

    getScenarioPrompt(): string {
        return this.prompt;
    }

    setMoveLongitudinal(value: LongitudinalMovement) {
        this.motion.longitudinal = value;
        this.emitMotion();
    }

    setMoveLateral(value: LateralMovement) {
        this.motion.lateral = value;
        this.emitMotion();
    }

    setLookHorizontal(value: HorizontalLook) {
        this.motion.lookHorizontal = value;
        this.emitMotion();
    }

    setLookVertical(value: VerticalLook) {
        this.motion.lookVertical = value;
        this.emitMotion();
    }

    async pause(): Promise<void> {
        this.setStatus("paused");
    }

    async resume(): Promise<void> {
        this.setStatus("generating");
    }

    async reset(): Promise<void> {
        this.motion = {
            longitudinal: "idle",
            lateral: "idle",
            lookHorizontal: "idle",
            lookVertical: "idle",
        };
        this.emitMotion();
        this.setStatus("ready");
    }

    dispose(): void {
        for (const t of this.timers) clearTimeout(t);
        this.timers = [];
        this.statusListeners.clear();
        this.motionListeners.clear();
        this.status = "idle";
    }

    onStatusChange(listener: (status: WorldStatus, error: string | null) => void): () => void {
        this.statusListeners.add(listener);
        listener(this.status, this.error);
        return () => this.statusListeners.delete(listener);
    }

    onMotionChange(listener: (motion: WorldMotion) => void): () => void {
        this.motionListeners.add(listener);
        listener({ ...this.motion });
        return () => this.motionListeners.delete(listener);
    }
}
