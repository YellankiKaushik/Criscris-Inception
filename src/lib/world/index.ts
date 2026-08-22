import { MockWorldProvider } from "./mockWorldProvider";
import type { WorldProvider } from "./types";

export type WorldProviderKind = "mock" | "reactor";

/** Provider selection is public configuration. Secrets never live in VITE_ vars. */
export function resolveProviderKind(): WorldProviderKind {
    const raw = import.meta.env["VITE_WORLD_PROVIDER"];
    return raw === "reactor" ? "reactor" : "mock";
}

/**
 * Creates the active world provider. The Reactor adapter is added later
 * (see architecture spec section 10); until then we always run the local world.
 */
export function createWorldProvider(): WorldProvider {
    return new MockWorldProvider();
}

export { MockWorldProvider };
export type { WorldProvider };
