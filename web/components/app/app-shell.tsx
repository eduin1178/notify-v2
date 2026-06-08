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
import { cn } from "@/lib/utils";

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
        {/* En el inbox, el shell es una columna de altura RÍGIDA (h-svh +
            overflow-hidden): el header ocupa su alto y el `main` el resto vía
            flex, sin `calc` ni desbordes de la ventana. El scroll vive dentro
            del hilo/lista. El resto de vistas conservan el flujo normal. */}
        <SidebarInset className={cn(fullBleed && "h-svh overflow-hidden")}>
          {/* El inbox oculta el header global para liberar el alto al layout de
              3 columnas; su `SidebarTrigger` vive en la barra de la lista. */}
          {!fullBleed && (
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
            </header>
          )}
          {fullBleed ? (
            <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
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
