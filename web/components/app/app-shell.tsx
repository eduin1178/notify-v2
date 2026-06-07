"use client";

import { usePathname } from "next/navigation";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar, type AppSidebarProps } from "@/components/app/app-sidebar";
import { Separator } from "@/components/ui/separator";

type Props = AppSidebarProps & {
  children: React.ReactNode;
};

export function AppShell({ children, ...sidebarProps }: Props) {
  const pathname = usePathname();
  // El inbox necesita ocupar todo el ancho/alto disponible (layout de 3 columnas
  // con scroll propio). El resto de vistas usan el contenedor centrado.
  const fullBleed = pathname?.endsWith("/inbox") ?? false;

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <AppSidebar {...sidebarProps} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
          </header>
          {fullBleed ? (
            // Altura DEFINIDA (viewport − header h-14) para que el `h-full` del
            // inbox resuelva y el scroll viva en la lista y el hilo, no en la
            // ventana. `min-h-svh` del wrapper no es altura definida.
            <main className="h-[calc(100svh-3.5rem)] overflow-hidden">
              {children}
            </main>
          ) : (
            <main className="flex-1 px-4 py-8">
              <div className="mx-auto w-full max-w-5xl">{children}</div>
            </main>
          )}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
