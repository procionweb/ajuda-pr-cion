import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { canAccessPortalPath, PortalAuthProvider, usePortalAuth } from "@/lib/portal-auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente novamente. Se o problema continuar, retorne à página inicial.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Portal Prócion — Central de Ajuda e Produtividade" },
      {
        name: "description",
        content:
          "Portal Prócion: base de conhecimento, atualizações, versões, kanban e gestão de clientes em um só lugar.",
      },
      { name: "author", content: "Prócion Sistemas" },
      { property: "og:title", content: "Portal Prócion — Central de Ajuda e Produtividade" },
      {
        property: "og:description",
        content:
          "Portal Prócion: base de conhecimento, atualizações, versões, kanban e gestão de clientes em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Portal Prócion — Central de Ajuda e Produtividade" },
      {
        name: "twitter:description",
        content:
          "Portal Prócion: base de conhecimento, atualizações, versões, kanban e gestão de clientes em um só lugar.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ba65d486-8a90-491a-8d73-8a6fa4385e37/id-preview-2dd673df--ff341c9e-6292-4b5c-9862-0a760d146e00.lovable.app-1783425476561.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ba65d486-8a90-491a-8d73-8a6fa4385e37/id-preview-2dd673df--ff341c9e-6292-4b5c-9862-0a760d146e00.lovable.app-1783425476561.png",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const themeInitScript = `(function(){try{var s=localStorage.getItem('procion:theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <PortalAuthProvider>
        <PortalRouteGuard />
        <Toaster richColors position="top-right" />
      </PortalAuthProvider>
    </QueryClientProvider>
  );
}

function PortalRouteGuard() {
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { loading, session, role } = usePortalAuth();

  useEffect(() => {
    if (loading) return;
    if (!session && pathname !== "/login") {
      void router.navigate({ to: "/login", replace: true });
      return;
    }
    if (session && pathname === "/login") {
      void router.navigate({ to: "/", replace: true });
      return;
    }
    if (session && !canAccessPortalPath(role, pathname)) {
      void router.navigate({ to: "/", replace: true });
    }
  }, [loading, pathname, role, router, session]);

  if (loading || (!session && pathname !== "/login")) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Carregando acesso...
      </div>
    );
  }
  return <Outlet />;
}
