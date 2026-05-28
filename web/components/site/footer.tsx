import { ThemeToggle } from "@/components/theme/theme-toggle";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6">
        <p className="text-sm text-muted-foreground">
          Notify · © {year}
        </p>
        <ThemeToggle align="end" side="top" />
      </div>
    </footer>
  );
}
