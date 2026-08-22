import type { WorldStatus } from "../scenario/types";

export type { WorldStatus };

export type LongitudinalMovement = "idle" | "forward" | "back";
export type LateralMovement = "idle" | "strafe_left" | "strafe_right";
export type HorizontalLook = "idle" | "left" | "right";
export type VerticalLook = "idle" | "up" | "down";

export interface WorldMotion {
  longitudinal: LongitudinalMovement;
  lateral: LateralMovement;
  lookHorizontal: HorizontalLook;
  lookVertical: VerticalLook;
}

export interface WorldProvider {
  readonly kind: "mock" | "reactor";

  initialize(input: { initialPrompt: string; seedImage?: Blob }): Promise<void>;
  start(): Promise<void>;
  setScenarioPrompt(prompt: string): Promise<void>;

  setMoveLongitudinal(value: LongitudinalMovement): Promise<void> | void;
  setMoveLateral(value: LateralMovement): Promise<void> | void;
  setLookHorizontal(value: HorizontalLook): Promise<void> | void;
  setLookVertical(value: VerticalLook): Promise<void> | void;

  pause(): Promise<void>;
  resume(): Promise<void>;
  reset(): Promise<void>;
  dispose(): Promise<void> | void;

  /** Subscribe to status changes. Returns an unsubscribe function. */
  onStatusChange(listener: (status: WorldStatus, error: string | null) => void): () => void;
  /** Subscribe to motion changes for viewport feedback. */
  onMotionChange(listener: (motion: WorldMotion) => void): () => void;
  /** Reactor main_video stream. Mock providers emit null. */
  onVideoStream(listener: (stream: MediaStream | null) => void): () => void;
}
