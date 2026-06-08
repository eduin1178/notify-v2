"use client";

/**
 * Suscripción de realtime del inbox vía Centrífugo (change
 * `inbox-realtime-centrifugo`, design D6). El realtime es una SEÑAL: cada
 * publicación dispara `mutate()` de SWR (la fuente de verdad sigue siendo la
 * API). Degrada con gracia: si no hay `NEXT_PUBLIC_CENTRIFUGO_WS_URL` o el WS no
 * conecta, el inbox sigue con el polling de respaldo (T7.3).
 *
 * Reglas de efectos del proyecto: NO se llama `setState` ni se mutan refs en
 * render. Las claves de SWR (que cambian con filtros/selección) se leen desde un
 * "latest ref" actualizado dentro de un efecto, para no re-crear la conexión en
 * cada cambio de filtro.
 */

import { useEffect, useRef } from "react";
import { Centrifuge, type PublicationContext } from "centrifuge";
import { useSWRConfig } from "swr";

import { convChannel, orgChannel } from "@/lib/services/realtime/channels";

// Pública: Next la inlinea en el bundle del cliente. Server `env.ts` no se
// importa aquí (validaría secretos del servidor en el navegador).
const WS_URL = process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL;

async function fetchConnectionToken(): Promise<string> {
  const res = await fetch("/api/v1/realtime/connection-token", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`connection-token ${res.status}`);
  const { token } = (await res.json()) as { token: string };
  return token;
}

async function fetchSubscriptionToken(
  orgId: string,
  channel: string,
): Promise<string> {
  const res = await fetch(
    `/api/v1/orgs/${orgId}/realtime/subscription-token`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    },
  );
  if (!res.ok) throw new Error(`subscription-token ${res.status}`);
  const { token } = (await res.json()) as { token: string };
  return token;
}

function publicationType(pub: PublicationContext): string | undefined {
  return (pub.data as { type?: string } | undefined)?.type;
}

export function useInboxRealtime({
  orgId,
  selectedId,
  conversationsKey,
  messagesKey,
}: {
  orgId: string;
  selectedId: string | null;
  conversationsKey: string | null;
  messagesKey: string | null;
}): void {
  const { mutate } = useSWRConfig();

  // Latest ref: las claves y `mutate` cambian; se guardan para usarlas dentro de
  // los manejadores sin re-crear la conexión. Se actualiza en un efecto (no en
  // render) para respetar la regla de lint.
  const latest = useRef({ mutate, conversationsKey, messagesKey });
  useEffect(() => {
    latest.current = { mutate, conversationsKey, messagesKey };
  });

  const centrifugeRef = useRef<Centrifuge | null>(null);

  // Conexión + suscripción al canal de la organización (vive con el inbox).
  useEffect(() => {
    if (!WS_URL) return; // Sin realtime → polling de respaldo.

    const centrifuge = new Centrifuge(WS_URL, {
      getToken: fetchConnectionToken,
    });
    centrifugeRef.current = centrifuge;

    const channel = orgChannel(orgId);
    const sub = centrifuge.newSubscription(channel, {
      getToken: () => fetchSubscriptionToken(orgId, channel),
    });
    sub.on("publication", () => {
      const { mutate: m, conversationsKey: ck } = latest.current;
      if (ck) m(ck);
    });
    sub.subscribe();

    // Reconexión del WS → revalida lista e hilo (recupera lo perdido, T7.2).
    centrifuge.on("connected", () => {
      const { mutate: m, conversationsKey: ck, messagesKey: mk } = latest.current;
      if (ck) m(ck);
      if (mk) m(mk);
    });

    centrifuge.connect();

    return () => {
      sub.unsubscribe();
      centrifuge.removeSubscription(sub);
      centrifuge.disconnect();
      centrifugeRef.current = null;
    };
  }, [orgId]);

  // Suscripción al canal de la conversación abierta; re-suscribe al cambiar y
  // limpia la anterior en el cleanup.
  useEffect(() => {
    const centrifuge = centrifugeRef.current;
    if (!WS_URL || !centrifuge || !selectedId) return;

    const channel = convChannel(selectedId);
    const existing = centrifuge.getSubscription(channel);
    const sub =
      existing ??
      centrifuge.newSubscription(channel, {
        getToken: () => fetchSubscriptionToken(orgId, channel),
      });
    sub.on("publication", (pub) => {
      const { mutate: m, messagesKey: mk, conversationsKey: ck } = latest.current;
      if (mk) m(mk);
      const type = publicationType(pub);
      if ((type === "delivery.update" || type === "message.new") && ck) {
        m(ck);
      }
    });
    sub.subscribe();

    return () => {
      sub.unsubscribe();
      centrifuge.removeSubscription(sub);
    };
  }, [orgId, selectedId]);
}
