import { fetchReactorJwt } from "@/lib/reactor/fetchClientToken";
import type {
  HorizontalLook,
  LateralMovement,
  LongitudinalMovement,
  VerticalLook,
  WorldMotion,
  WorldProvider,
  WorldStatus,
} from "./types";

type LingbotWorld2Model = import("@reactor-models/lingbot-world-2").LingbotWorld2Model;
type ReactorFileRef = Awaited<ReturnType<LingbotWorld2Model["uploadFile"]>>;

const SEED_PATH = "/warehouse-seed.jpg";
const SEED_UPLOAD_RETRY_MS = 750;
const SEED_UPLOAD_READY_TIMEOUT_MS = 105_000;

const idleMotion = (): WorldMotion => ({
  longitudinal: "idle",
  lateral: "idle",
  lookHorizontal: "idle",
  lookVertical: "idle",
});

function safeCommandMessage(command: string, reason: string): string {
  const blob = `${command} ${reason}`.toLowerCase();
  if (blob.includes("credit") || blob.includes("quota") || blob.includes("billing")) {
    return "World-model credits are exhausted. Switch to Demo World to continue.";
  }
  if (blob.includes("rate") || blob.includes("429")) {
    return "The world-model service is rate-limited. Try again or switch to Demo World.";
  }
  if (blob.includes("auth") || blob.includes("token") || blob.includes("unauthorized")) {
    return "World-model authentication failed. Switch to Demo World to continue.";
  }
  if (command === "set_image") {
    return "The warehouse seed image was rejected by the world model.";
  }
  if (command === "set_prompt") {
    return "The scenario prompt was rejected by the world model.";
  }
  if (command === "start") {
    return "The world model could not start generating video.";
  }
  return "The generated world reported a command error.";
}

async function loadSeedFile(provided?: Blob): Promise<File> {
  if (provided && provided.size > 0) {
    return new File([provided], "warehouse-seed.jpg", {
      type: provided.type || "image/jpeg",
    });
  }
  const response = await fetch(SEED_PATH);
  if (!response.ok) {
    throw new Error("Warehouse seed image is missing from the application.");
  }
  const blob = await response.blob();
  return new File([blob], "warehouse-seed.jpg", { type: blob.type || "image/jpeg" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientUploadReadinessError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /status is ["']?(waiting|connecting)["']?/i.test(message);
}

async function uploadSeedWhenReady(model: LingbotWorld2Model, seed: File): Promise<ReactorFileRef> {
  const deadline = Date.now() + SEED_UPLOAD_READY_TIMEOUT_MS;

  while (true) {
    try {
      return await model.uploadFile(seed);
    } catch (error) {
      if (!isTransientUploadReadinessError(error)) {
        throw error;
      }

      if (Date.now() + SEED_UPLOAD_RETRY_MS > deadline) {
        throw new Error(
          "Timed out waiting for the Reactor session to become ready before uploading the warehouse seed.",
        );
      }

      await sleep(SEED_UPLOAD_RETRY_MS);
    }
  }
}

function hasDisconnect(
  model: LingbotWorld2Model,
): model is LingbotWorld2Model & { disconnect: () => Promise<void> | void } {
  return (
    "disconnect" in model && typeof (model as { disconnect?: unknown }).disconnect === "function"
  );
}

/**
 * LingBot World 2 adapter. UI never imports the SDK; this class owns the session.
 */
export class ReactorWorldProvider implements WorldProvider {
  readonly kind = "reactor" as const;

  private status: WorldStatus = "idle";
  private error: string | null = null;
  private prompt = "";
  private lastPrompt = "";
  private motion: WorldMotion = idleMotion();
  private stream: MediaStream | null = null;
  private model: LingbotWorld2Model | null = null;
  private connected = false;
  private initPromise: Promise<void> | null = null;
  private disposed = false;

  private statusListeners = new Set<(status: WorldStatus, error: string | null) => void>();
  private motionListeners = new Set<(motion: WorldMotion) => void>();
  private videoListeners = new Set<(stream: MediaStream | null) => void>();
  private unsubscribers: Array<() => void> = [];

  private setStatus(status: WorldStatus, error: string | null = null) {
    this.status = status;
    this.error = error;
    for (const l of this.statusListeners) l(status, error);
  }

  private emitMotion() {
    for (const l of this.motionListeners) l({ ...this.motion });
  }

  private emitVideo(stream: MediaStream | null) {
    this.stream = stream;
    for (const l of this.videoListeners) l(stream);
  }

  private bindModel(model: LingbotWorld2Model) {
    this.unsubscribers.push(
      model.onMainVideo((_track, stream) => {
        this.emitVideo(stream);
      }),
    );
    this.unsubscribers.push(
      model.onCommandError((msg) => {
        const command = typeof msg.command === "string" ? msg.command : "unknown";
        const reason = typeof msg.reason === "string" ? msg.reason : "";
        if (
          command === "set_move_longitudinal" ||
          command === "set_move_lateral" ||
          command === "set_look_horizontal" ||
          command === "set_look_vertical"
        ) {
          return;
        }
        this.setStatus("error", safeCommandMessage(command, reason));
      }),
    );
    this.unsubscribers.push(
      model.onGenerationStarted(() => {
        this.setStatus("generating");
      }),
    );
    this.unsubscribers.push(
      model.onGenerationPaused(() => {
        this.setStatus("paused");
      }),
    );
    this.unsubscribers.push(
      model.onGenerationResumed(() => {
        this.setStatus("generating");
      }),
    );
    this.unsubscribers.push(model.onImageAccepted(() => undefined));
    this.unsubscribers.push(model.onPromptAccepted(() => undefined));
    this.unsubscribers.push(model.onConditionsReady(() => undefined));
    this.unsubscribers.push(model.onChunkComplete(() => undefined));
  }

  async initialize(input: { initialPrompt: string; seedImage?: Blob }): Promise<void> {
    if (this.disposed) {
      throw new Error("World provider already disposed.");
    }
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    this.prompt = input.initialPrompt;
    this.setStatus("connecting");

    this.initPromise = this.connectAndArm(input);
    try {
      await this.initPromise;
    } catch (error) {
      this.initPromise = null;
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to initialize the generated world.";
      this.setStatus("error", message);
      throw error;
    }
  }

  private async connectAndArm(input: { initialPrompt: string; seedImage?: Blob }): Promise<void> {
    const { LingbotWorld2Model } = await import("@reactor-models/lingbot-world-2");
    let model = this.model;

    if (!model || !this.connected) {
      const jwt = await fetchReactorJwt();
      model = new LingbotWorld2Model();
      this.model = model;
      this.bindModel(model);

      await model.connect(jwt);
      this.connected = true;
    }

    const seed = await loadSeedFile(input.seedImage);
    const fileRef = await uploadSeedWhenReady(model, seed);
    await model.setImage({ image: fileRef });
    await model.setPrompt({ prompt: input.initialPrompt });
    this.lastPrompt = input.initialPrompt;
    this.setStatus("ready");
  }

  async start(): Promise<void> {
    if (!this.model) {
      throw new Error("World model is not initialized.");
    }
    await this.model.start();
    this.setStatus("generating");
  }

  async setScenarioPrompt(prompt: string): Promise<void> {
    if (!this.model || prompt === this.lastPrompt) return;
    this.prompt = prompt;
    this.lastPrompt = prompt;
    await this.model.setPrompt({ prompt });
  }

  setMoveLongitudinal(value: LongitudinalMovement) {
    this.motion.longitudinal = value;
    this.emitMotion();
    void this.model?.setMoveLongitudinal({ move_longitudinal: value });
  }

  setMoveLateral(value: LateralMovement) {
    this.motion.lateral = value;
    this.emitMotion();
    void this.model?.setMoveLateral({ move_lateral: value });
  }

  setLookHorizontal(value: HorizontalLook) {
    this.motion.lookHorizontal = value;
    this.emitMotion();
    void this.model?.setLookHorizontal({ look_horizontal: value });
  }

  setLookVertical(value: VerticalLook) {
    this.motion.lookVertical = value;
    this.emitMotion();
    void this.model?.setLookVertical({ look_vertical: value });
  }

  async pause(): Promise<void> {
    await this.idleAll();
    await this.model?.pause();
    this.setStatus("paused");
  }

  async resume(): Promise<void> {
    await this.model?.resume();
    this.setStatus("generating");
  }

  async reset(): Promise<void> {
    await this.idleAll();
    this.emitVideo(null);
    this.lastPrompt = "";
    await this.model?.reset();
    this.initPromise = null;
    this.setStatus("ready");
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.idleAll();
    this.emitVideo(null);
    for (const off of this.unsubscribers) {
      try {
        off();
      } catch {
        /* ignore */
      }
    }
    this.unsubscribers = [];
    if (this.model && this.connected && hasDisconnect(this.model)) {
      try {
        await this.model.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.model = null;
    this.connected = false;
    this.initPromise = null;
    this.statusListeners.clear();
    this.motionListeners.clear();
    this.videoListeners.clear();
    this.status = "idle";
  }

  private async idleAll() {
    this.motion = idleMotion();
    this.emitMotion();
    if (!this.model) return;
    try {
      await this.model.setMoveLongitudinal({ move_longitudinal: "idle" });
      await this.model.setMoveLateral({ move_lateral: "idle" });
      await this.model.setLookHorizontal({ look_horizontal: "idle" });
      await this.model.setLookVertical({ look_vertical: "idle" });
    } catch {
      /* ignore */
    }
  }

  onStatusChange(listener: (status: WorldStatus, error: string | null) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status, this.error);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  onMotionChange(listener: (motion: WorldMotion) => void): () => void {
    this.motionListeners.add(listener);
    listener({ ...this.motion });
    return () => {
      this.motionListeners.delete(listener);
    };
  }

  onVideoStream(listener: (stream: MediaStream | null) => void): () => void {
    this.videoListeners.add(listener);
    listener(this.stream);
    return () => {
      this.videoListeners.delete(listener);
    };
  }
}
