"use client";

import * as React from "react";
import {
  ArrowSquareOutIcon,
  GithubLogoIcon,
  GoogleLogoIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

type ProviderId = "google" | "github";

type ProviderMeta = {
  id: ProviderId;
  label: string;
  manageUrl: string;
  Icon: React.ComponentType<{ weight?: "bold" }>;
};

const PROVIDERS: ProviderMeta[] = [
  {
    id: "google",
    label: "Google",
    manageUrl: "https://myaccount.google.com",
    Icon: GoogleLogoIcon,
  },
  {
    id: "github",
    label: "GitHub",
    manageUrl: "https://github.com/settings/profile",
    Icon: GithubLogoIcon,
  },
];

type AccountRow = {
  provider?: string;
  providerId?: string;
  accountId?: string;
};

export function ConnectionsSection() {
  const [linked, setLinked] = React.useState<Set<ProviderId>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [pending, setPending] = React.useState<ProviderId | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const result = (await authClient.listAccounts()) as
        | { data?: AccountRow[] | null }
        | AccountRow[]
        | null;
      const rows: AccountRow[] = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? (result.data as AccountRow[])
          : [];
      const next = new Set<ProviderId>();
      for (const row of rows) {
        const id = (row.provider ?? row.providerId) as ProviderId | undefined;
        if (id === "google" || id === "github") next.add(id);
      }
      setLinked(next);
    } catch {
      setError("No pudimos cargar tus conexiones. Recarga la página.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function handleLink(provider: ProviderId) {
    setPending(provider);
    setError(null);
    try {
      await authClient.linkSocial({ provider, callbackURL: "/account" });
    } catch {
      setError("No pudimos iniciar la vinculación. Inténtalo de nuevo.");
      setPending(null);
    }
  }

  async function handleUnlink(provider: ProviderId) {
    setPending(provider);
    setError(null);
    try {
      const result = (await authClient.unlinkAccount({
        providerId: provider,
      })) as { error?: { message?: string } | null } | undefined;
      if (result?.error) {
        setError(
          result.error.message ??
            "No puedes desvincular tu único proveedor de acceso.",
        );
      } else {
        await refresh();
      }
    } catch {
      setError("No puedes desvincular tu único proveedor de acceso.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-lg border bg-card p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Conexiones</h2>
        <p className="text-sm text-muted-foreground">
          Vincula los proveedores con los que inicias sesión. Necesitas mantener
          al menos uno vinculado.
        </p>
      </header>
      <ul className="divide-y">
        {PROVIDERS.map(({ id, label, manageUrl, Icon }) => {
          const isLinked = linked.has(id);
          const isPending = pending === id;
          return (
            <li
              key={id}
              className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <Icon weight="bold" />
              <div className="flex-1">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {loading
                    ? "Cargando…"
                    : isLinked
                      ? "Vinculado"
                      : "No vinculado"}
                </p>
              </div>
              {isLinked ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={manageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Gestionar cuenta
                      <ArrowSquareOutIcon className="ml-1" />
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void handleUnlink(id)}
                  >
                    {isPending ? (
                      <SpinnerGapIcon className="animate-spin" weight="bold" />
                    ) : null}
                    Desvincular
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={loading || isPending}
                  onClick={() => void handleLink(id)}
                >
                  {isPending ? (
                    <SpinnerGapIcon className="animate-spin" weight="bold" />
                  ) : null}
                  Vincular
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
