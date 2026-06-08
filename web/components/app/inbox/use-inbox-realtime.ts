"use client";

/**
 * Suscripción de realtime del inbox vía Centrífugo (change
 * `inbox-realtime-centrifugo`, design D6). El realtime empuja el mensaje
 * enriquecido (render directo) y revalida SWR para reconciliar. Degrada con
 * gracia: si no hay `NEXT_PUBLIC_CENTRIFUGO_WS_URL` o el WS no conecta, el inbox
 * sigue con el polling de respaldo (T7.3).
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
import type {
  MessageDtoT,
  MessageThreadResponseT,
} from "@/lib/services/inbox/schemas";

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

type InboxPublication = {
  type?: string;
  /** Mensaje completo para render directo (enriquecimiento del payload). */
  message?: MessageDtoT;
  /**
   * Id temporal del eco optimista que este evento reemplaza/elimina (settle o
   * failed). Permite cambiar la burbuja "sending" por la real sin duplicar.
   */
  replacesClientId?: string;
};

function publicationData(pub: PublicationContext): InboxPublication | undefined {
  return pub.data as InboxPublication | undefined;
}

/**
 * Inserta o actualiza el mensaje en la caché del hilo (newest-first). Si trae
 * `replacesClientId`, primero quita la burbuja optimista temporal (settle). Si el
 * `id` ya existe lo actualiza en sitio (p. ej. cambio de estado); si no, lo
 * antepone. Dedup por `id` (= WAMID): convive con el read-through y con el eco
 * optimista del emisor sin duplicar.
 */
function upsertMessageInThread(
  cur: MessageThreadResponseT | undefined,
  msg: MessageDtoT,
  replacesClientId?: string,
): MessageThreadResponseT {
  const base = cur ?? { items: [], nextCursor: null };
  let items = replacesClientId
    ? base.items.filter((m) => m.id !== replacesClientId)
    : base.items;
  items = items.some((m) => m.id === msg.id)
    ? items.map((m) => (m.id === msg.id ? msg : m))
    : [msg, ...items];
  return { ...base, items };
}

/** Quita un mensaje del hilo por id (revierte un eco optimista que falló). */
function removeMessageFromThread(
  cur: MessageThreadResponseT | undefined,
  id: string,
): MessageThreadResponseT {
  const base = cur ?? { items: [], nextCursor: null };
  return { ...base, items: base.items.filter((m) => m.id !== id) };
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
      const data = publicationData(pub);
      if (mk) {
        if (data?.type === "message.failed" && data.replacesClientId) {
          const rcid = data.replacesClientId;
          m(mk, (cur?: MessageThreadResponseT) => removeMessageFromThread(cur, rcid), {
            revalidate: false,
          });
        } else if (data?.type === "message.new" && data.message) {
          const msg = data.message;
          const rcid = data.replacesClientId;
          // Salientes (optimista/settle): NO revalidar para no parpadear si el
          // read-through de Kapso aún no tiene el mensaje. Entrantes: revalidar
          // para resolver la media por read-through.
          const revalidate = msg.direction === "inbound";
          m(mk, (cur?: MessageThreadResponseT) => upsertMessageInThread(cur, msg, rcid), {
            revalidate,
          });
        } else {
          m(mk);
        }
      }
      if ((data?.type === "delivery.update" || data?.type === "message.new") && ck) {
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
