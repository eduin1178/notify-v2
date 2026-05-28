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
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <AppSidebar {...sidebarProps} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
          </header>
          <main className="flex-1 px-4 py-8">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
