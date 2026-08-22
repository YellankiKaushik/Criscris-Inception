import { MockWorldProvider } from "./mockWorldProviders";
import { ReactorWorldProvider } from "./reactorWorldProvider";
import type { WorldProvider } from "./types";

export type WorldProviderKind = "mock" | "reactor";

/** Provider selection is public configuration. Secrets never live in VITE_ vars. */
export function resolveProviderKind(): WorldProviderKind {
  const raw = import.meta.env["VITE_WORLD_PROVIDER"];
  return raw === "reactor" ? "reactor" : "mock";
}

export function createWorldProvider(
  kind: WorldProviderKind = resolveProviderKind(),
): WorldProvider {
  if (kind === "reactor") {
    return new ReactorWorldProvider();
  }
  return new MockWorldProvider();
}

export { MockWorldProvider, ReactorWorldProvider };
export type { WorldProvider };
