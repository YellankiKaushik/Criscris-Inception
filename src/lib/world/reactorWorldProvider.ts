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
const REACTOR_ACK_TIMEOUT_MS = 40_000;
const REACTOR_MAIN_VIDEO_TIMEOUT_MS = 30_000;
const REACTOR_CONNECT_RETRY_DELAYS_MS = [3_000, 6_000, 10_000] as const;
const REACTOR_CAPACITY_ERROR_MESSAGE =
  "Reactor is currently at capacity. Try again shortly or switch to Demo Mode.";
const REACTOR_MAIN_VIDEO_ERROR_MESSAGE =
  "Reactor started the world but no video stream became available. Try again or switch to Demo Mode.";

type PendingReactorAck = {
  promise: Promise<void>;
  timeoutId: ReturnType<typeof setTimeout>;
  resolve: () => void;
  reject: (error: Error) => void;
};

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

function isReactorCapacityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("no available capacity") ||
    normalized.includes("no available servers") ||
    (normalized.includes("429") &&
      (normalized.includes("capacity") || normalized.includes("no available")))
  );
}

function isUsableMainVideoStream(track: MediaStreamTrack, stream: MediaStream): boolean {
  return (
    track.kind === "video" &&
    track.readyState !== "ended" &&
    stream.getVideoTracks().some((videoTrack) => videoTrack.id === track.id)
  );
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

async function disconnectQuietly(model: LingbotWorld2Model): Promise<void> {
  if (!hasDisconnect(model)) return;
  try {
    await model.disconnect();
  } catch {
    /* ignore */
  }
}

async function connectModelWithCapacityRetry(
  createModel: () => LingbotWorld2Model,
  jwt: string,
): Promise<LingbotWorld2Model> {
  const maxAttempts = REACTOR_CONNECT_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const model = createModel();
    try {
      await model.connect(jwt);
      return model;
    } catch (error) {
      await disconnectQuietly(model);
      if (!isReactorCapacityError(error)) {
        throw error;
      }

      if (attempt === maxAttempts) {
        throw new Error(REACTOR_CAPACITY_ERROR_MESSAGE);
      }

      if (import.meta.env.DEV) {
        console.info(
          `[Criscris/Reactor] capacity unavailable; retry ${attempt + 1}/${maxAttempts}`,
        );
      }
      await sleep(REACTOR_CONNECT_RETRY_DELAYS_MS[attempt - 1]);
    }
  }

  throw new Error(REACTOR_CAPACITY_ERROR_MESSAGE);
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
  private conditionsReady = false;
  private generationStarted = false;
  private mainVideoReady = false;
  private pendingConditionsReady: PendingReactorAck | null = null;
  private pendingGenerationStarted: PendingReactorAck | null = null;
  private pendingMainVideoReady: PendingReactorAck | null = null;

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

  private waitForConditionsReady(): Promise<void> {
    if (this.conditionsReady) return Promise.resolve();
    if (this.pendingConditionsReady) return this.pendingConditionsReady.promise;

    const pending = {} as PendingReactorAck;
    pending.promise = new Promise<void>((resolve, reject) => {
      pending.timeoutId = setTimeout(() => {
        if (this.pendingConditionsReady === pending) {
          this.pendingConditionsReady = null;
        }
        reject(new Error("Timed out waiting for the Reactor session conditions to become ready."));
      }, REACTOR_ACK_TIMEOUT_MS);
      pending.resolve = () => resolve();
      pending.reject = reject;
    });
    this.pendingConditionsReady = pending;
    return pending.promise;
  }

  private resolvePendingConditionsReady() {
    const pending = this.pendingConditionsReady;
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    this.pendingConditionsReady = null;
    pending.resolve();
  }

  private rejectPendingConditionsReady(error: Error) {
    const pending = this.pendingConditionsReady;
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    this.pendingConditionsReady = null;
    pending.reject(error);
  }

  private waitForGenerationStarted(): Promise<void> {
    if (this.generationStarted) return Promise.resolve();
    if (this.pendingGenerationStarted) return this.pendingGenerationStarted.promise;

    const pending = {} as PendingReactorAck;
    pending.promise = new Promise<void>((resolve, reject) => {
      pending.timeoutId = setTimeout(() => {
        if (this.pendingGenerationStarted === pending) {
          this.pendingGenerationStarted = null;
        }
        reject(new Error("Timed out waiting for the Reactor world to start generating video."));
      }, REACTOR_ACK_TIMEOUT_MS);
      pending.resolve = () => resolve();
      pending.reject = reject;
    });
    this.pendingGenerationStarted = pending;
    return pending.promise;
  }

  private resolvePendingGenerationStarted() {
    const pending = this.pendingGenerationStarted;
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    this.pendingGenerationStarted = null;
    pending.resolve();
  }

  private rejectPendingGenerationStarted(error: Error) {
    const pending = this.pendingGenerationStarted;
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    this.pendingGenerationStarted = null;
    pending.reject(error);
  }

  private waitForMainVideoReady(): Promise<void> {
    if (this.mainVideoReady) return Promise.resolve();
    if (this.pendingMainVideoReady) return this.pendingMainVideoReady.promise;

    const pending = {} as PendingReactorAck;
    pending.promise = new Promise<void>((resolve, reject) => {
      pending.timeoutId = setTimeout(() => {
        if (this.pendingMainVideoReady === pending) {
          this.pendingMainVideoReady = null;
        }
        reject(new Error(REACTOR_MAIN_VIDEO_ERROR_MESSAGE));
      }, REACTOR_MAIN_VIDEO_TIMEOUT_MS);
      pending.resolve = () => resolve();
      pending.reject = reject;
    });
    this.pendingMainVideoReady = pending;
    return pending.promise;
  }

  private resolvePendingMainVideoReady() {
    const pending = this.pendingMainVideoReady;
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    this.pendingMainVideoReady = null;
    pending.resolve();
  }

  private rejectPendingMainVideoReady(error: Error) {
    const pending = this.pendingMainVideoReady;
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    this.pendingMainVideoReady = null;
    pending.reject(error);
  }

  private clearPendingAcks(error: Error) {
    this.rejectPendingConditionsReady(error);
    this.rejectPendingGenerationStarted(error);
    this.rejectPendingMainVideoReady(error);
  }

  private bindModel(model: LingbotWorld2Model) {
    this.unsubscribers.push(
      model.onMainVideo((track, stream) => {
        this.emitVideo(stream);
        if (isUsableMainVideoStream(track, stream)) {
          this.mainVideoReady = true;
          this.resolvePendingMainVideoReady();
        }
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
        const safeMessage = safeCommandMessage(command, reason);
        if (command === "set_image" || command === "set_prompt") {
          this.rejectPendingConditionsReady(new Error(safeMessage));
        }
        if (command === "start") {
          this.rejectPendingGenerationStarted(new Error(safeMessage));
          this.rejectPendingMainVideoReady(new Error(safeMessage));
        }
        this.setStatus("error", safeMessage);
      }),
    );
    this.unsubscribers.push(
      model.onGenerationStarted(() => {
        this.generationStarted = true;
        this.resolvePendingGenerationStarted();
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
    this.unsubscribers.push(
      model.onConditionsReady((msg) => {
        this.conditionsReady = msg.has_image && msg.has_prompt;
        if (this.conditionsReady) {
          this.resolvePendingConditionsReady();
        }
      }),
    );
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
    this.mainVideoReady = false;
    this.emitVideo(null);

    if (!model || !this.connected) {
      const jwt = await fetchReactorJwt();
      model = await connectModelWithCapacityRetry(() => new LingbotWorld2Model(), jwt);
      this.model = model;
      this.bindModel(model);
      this.connected = true;
    }

    const seed = await loadSeedFile(input.seedImage);
    const fileRef = await uploadSeedWhenReady(model, seed);
    this.conditionsReady = false;
    this.generationStarted = false;
    await model.setImage({ image: fileRef });
    await model.setPrompt({ prompt: input.initialPrompt });
    await this.waitForConditionsReady();
    this.lastPrompt = input.initialPrompt;
    this.setStatus("ready");
  }

  async start(): Promise<void> {
    if (!this.model) {
      throw new Error("World model is not initialized.");
    }
    this.generationStarted = false;
    const generationStarted = this.waitForGenerationStarted();
    const mainVideoReady = this.waitForMainVideoReady();
    try {
      await this.model.start();
    } catch {
      const error = new Error(safeCommandMessage("start", ""));
      this.rejectPendingGenerationStarted(error);
      this.rejectPendingMainVideoReady(error);
    }
    await Promise.all([generationStarted, mainVideoReady]);
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
    this.clearPendingAcks(new Error("The Reactor session was reset before it became ready."));
    this.conditionsReady = false;
    this.generationStarted = false;
    this.mainVideoReady = false;
    await this.idleAll();
    this.emitVideo(null);
    this.lastPrompt = "";
    await this.model?.reset();
    this.initPromise = null;
    this.setStatus("idle");
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.clearPendingAcks(new Error("The Reactor session was closed before it became ready."));
    this.conditionsReady = false;
    this.generationStarted = false;
    this.mainVideoReady = false;
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
