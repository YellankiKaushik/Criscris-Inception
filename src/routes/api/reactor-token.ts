import { createFileRoute } from "@tanstack/react-router";
import { mintReactorSessionToken } from "@/lib/reactor/mintToken";

export const Route = createFileRoute("/api/reactor-token")({
  server: {
    handlers: {
      POST: async () => mintReactorSessionToken(),
    },
  },
});
