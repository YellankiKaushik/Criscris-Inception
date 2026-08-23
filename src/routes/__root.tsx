import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import appCss from "../styles.css?url";

const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Criscris — Emergency Response Simulation" },
      {
        name: "description",
        content: "Interactive emergency-response simulation powered by real-time world models.",
      },
      { name: "author", content: "Kaushik Yellanki" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: GOOGLE_FONTS },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main className="grid-backdrop flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="label-tech">Criscris</p>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase">Page not found</h1>
        <a
          href="/"
          className="mt-6 inline-block rounded bg-primary px-5 py-3 font-display uppercase tracking-widest text-primary-foreground"
        >
          Return to simulation
        </a>
      </div>
    </main>
  );
}
