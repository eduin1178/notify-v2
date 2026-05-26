import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <span className="text-base font-semibold tracking-tight">Notify</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" type="button">
            Iniciar sesión
          </Button>
          <Button variant="default" size="sm" type="button">
            Registrarse
          </Button>
        </div>
      </div>
    </header>
  );
}
