"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BuildingsIcon,
  PlusIcon,
  SignOutIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

type Membership = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type ListRow = {
  id: string;
  name: string;
  slug: string;
  role?: string;
  memberRole?: string;
};

function roleLabel(role: string): string {
  switch (role) {
    case "owner":
      return "Propietario";
    case "admin":
      return "Administrador";
    case "member":
      return "Miembro";
    default:
      return role;
  }
}

export function OrganizationsSection() {
  const router = useRouter();
  const [orgs, setOrgs] = React.useState<Membership[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<Membership | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const result = (await authClient.organization.list()) as
        | { data?: ListRow[] | null }
        | ListRow[]
        | null;
      const rows: ListRow[] = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? (result.data as ListRow[])
          : [];
      setOrgs(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          role: r.role ?? r.memberRole ?? "member",
        })),
      );
    } catch {
      setError("No pudimos cargar tus organizaciones. Recarga la página.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function handleLeave(org: Membership) {
    setPendingId(org.id);
    setError(null);
    try {
      const result = (await authClient.organization.leave({
        organizationId: org.id,
      })) as { error?: { message?: string } | null } | undefined;
      if (result?.error) {
        setError(
          result.error.message ??
            "No puedes salir de esta organización porque eres el único propietario.",
        );
      } else {
        await refresh();
        router.refresh();
      }
    } catch {
      setError(
        "No puedes salir de esta organización porque eres el único propietario.",
      );
    } finally {
      setPendingId(null);
      setTarget(null);
    }
  }

  return (
    <section className="rounded-lg border bg-card p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Organizaciones</h2>
        <p className="text-sm text-muted-foreground">
          Espacios a los que perteneces y tu rol en cada uno.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : orgs.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-4">
          <p className="text-sm text-muted-foreground">
            No perteneces a ninguna organización.
          </p>
          <Button asChild size="sm">
            <Link href="/onboarding/new-org">
              <PlusIcon weight="bold" />
              Crear organización
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y">
          {orgs.map((org) => {
            const isPending = pendingId === org.id;
            return (
              <li
                key={org.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex size-9 items-center justify-center rounded-md border bg-background">
                  <BuildingsIcon weight="bold" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{org.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {roleLabel(org.role)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setTarget(org)}
                >
                  {isPending ? (
                    <SpinnerGapIcon className="animate-spin" weight="bold" />
                  ) : (
                    <SignOutIcon weight="bold" />
                  )}
                  Salir
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salir de la organización</AlertDialogTitle>
            <AlertDialogDescription>
              {target
                ? `Vas a salir de "${target.name}". Perderás el acceso hasta que recibas una nueva invitación.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (target) void handleLeave(target);
              }}
            >
              Salir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
