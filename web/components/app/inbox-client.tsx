"use client";

import { useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  ChatCircleTextIcon,
  GearSixIcon,
  MagnifyingGlassIcon,
  ClockIcon,
} from "@phosphor-icons/react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  ConversationDtoT,
  ConversationListResponseT,
  InboxNumberDtoT,
  InboxSettingsDtoT,
  MessageDtoT,
  MessageThreadResponseT,
  NotifyStatusT,
} from "@/lib/services/inbox/schemas";

type StatusFilter = "" | NotifyStatusT;
type AssignmentFilter = "all" | "mine" | "unassigned" | "others";
type Tab = "todas" | "sin-leer";

type MemberLite = { userId: string; name: string };
type MembersResponse = { members: MemberLite[] };

type Props = {
  orgId: string;
  numbers: InboxNumberDtoT[];
  initialConnectionId: string | null;
  initialConversations: ConversationDtoT[];
  canConfigure: boolean;
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
};

async function apiSend(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json().catch(() => null);
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtRemaining(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m restantes`;
}

function displayName(conv: ConversationDtoT): string {
  if (conv.contact) {
    return `${conv.contact.firstName} ${conv.contact.lastName ?? ""}`.trim();
  }
  return conv.phoneNumber ?? "Desconocido";
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const STATUS_LABEL: Record<string, string> = {
  abierta: "Abierta",
  pendiente: "Pendiente",
  cerrada: "Cerrada",
};

export function InboxClient({
  orgId,
  numbers,
  initialConnectionId,
  initialConversations,
  canConfigure,
}: Props) {
  const { mutate } = useSWRConfig();
  const [connectionId, setConnectionId] = useState<string | null>(
    initialConnectionId,
  );
  const [tab, setTab] = useState<Tab>("todas");
  const [status, setStatus] = useState<StatusFilter>("");
  const [assignment, setAssignment] = useState<AssignmentFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const conversationsKey = useMemo(() => {
    if (!connectionId) return null;
    const params = new URLSearchParams();
    params.set("connectionId", connectionId);
    params.set("assignment", assignment);
    params.set("page", "1");
    params.set("pageSize", "30");
    if (status) params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    return `/api/v1/orgs/${orgId}/inbox/conversations?${params.toString()}`;
  }, [orgId, connectionId, assignment, status, search]);

  const isInitialKey =
    connectionId === initialConnectionId &&
    assignment === "all" &&
    status === "" &&
    search.trim() === "";

  const { data: convData, isLoading: convLoading } =
    useSWR<ConversationListResponseT>(conversationsKey, fetcher, {
      refreshInterval: 4000,
      keepPreviousData: true,
      fallbackData: isInitialKey
        ? {
            items: initialConversations,
            page: 1,
            pageSize: 30,
            total: initialConversations.length,
            totalPages: 1,
          }
        : undefined,
    });

  const { data: membersData } = useSWR<MembersResponse>(
    `/api/v1/orgs/${orgId}/members`,
    fetcher,
  );

  const conversations = useMemo(() => {
    const items = convData?.items ?? [];
    return tab === "sin-leer" ? items.filter((c) => c.unreadCount > 0) : items;
  }, [convData, tab]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const messagesKey = selectedId
    ? `/api/v1/orgs/${orgId}/inbox/conversations/${selectedId}/messages?limit=50`
    : null;

  const { data: msgData, isLoading: msgLoading } =
    useSWR<MessageThreadResponseT>(messagesKey, fetcher, {
      refreshInterval: 4000,
      keepPreviousData: true,
    });

  const messages = useMemo(
    () => [...(msgData?.items ?? [])].reverse(),
    [msgData],
  );

  const unreadTotal = (convData?.items ?? []).reduce(
    (acc, c) => acc + (c.unreadCount > 0 ? 1 : 0),
    0,
  );

  const revalidate = () => {
    if (conversationsKey) mutate(conversationsKey);
  };

  function selectConversation(conv: ConversationDtoT) {
    setSelectedId(conv.id);
    if (conv.unreadCount > 0) {
      apiSend(
        `/api/v1/orgs/${orgId}/inbox/conversations/${conv.id}/read`,
        "POST",
      )
        .then(revalidate)
        .catch(() => {});
    }
  }

  async function changeStatus(value: NotifyStatusT) {
    if (!selected) return;
    await apiSend(
      `/api/v1/orgs/${orgId}/inbox/conversations/${selected.id}`,
      "PATCH",
      { status: value },
    );
    revalidate();
  }

  async function changeAssignment(userId: string) {
    if (!selected) return;
    await apiSend(
      `/api/v1/orgs/${orgId}/inbox/conversations/${selected.id}/assignment`,
      "PUT",
      { userId: userId || null },
    );
    revalidate();
  }

  if (!connectionId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <ChatCircleTextIcon className="size-10 text-muted-foreground" />
        <h2 className="text-lg font-medium">Aún no hay números conectados</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Conecta un número de WhatsApp para empezar a recibir y responder
          conversaciones en el inbox.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Columna izquierda: lista ─────────────────────────────────── */}
      <aside className="flex w-80 shrink-0 flex-col border-r">
        <div className="space-y-3 border-b p-3">
          <div className="flex items-center gap-2">
            <NativeSelect
              value={connectionId}
              onChange={(e) => {
                setConnectionId(e.target.value);
                setSelectedId(null);
              }}
              aria-label="Número de WhatsApp"
            >
              {numbers.map((n) => (
                <option key={n.connectionId} value={n.connectionId}>
                  {n.name ?? n.displayPhoneNumber ?? n.phoneNumberId ?? "Número"}
                </option>
              ))}
            </NativeSelect>
            {canConfigure && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                aria-label="Configuración del número"
              >
                <GearSixIcon />
              </Button>
            )}
          </div>

          <div className="flex gap-1 text-sm">
            <button
              type="button"
              onClick={() => setTab("todas")}
              className={cn(
                "rounded-md px-2.5 py-1",
                tab === "todas"
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setTab("sin-leer")}
              className={cn(
                "rounded-md px-2.5 py-1",
                tab === "sin-leer"
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              Sin leer{unreadTotal > 0 ? ` (${unreadTotal})` : ""}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NativeSelect
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              aria-label="Estado"
            >
              <option value="">Todos los estados</option>
              <option value="abierta">Abierta</option>
              <option value="pendiente">Pendiente</option>
              <option value="cerrada">Cerrada</option>
            </NativeSelect>
            <NativeSelect
              value={assignment}
              onChange={(e) =>
                setAssignment(e.target.value as AssignmentFilter)
              }
              aria-label="Asignación"
            >
              <option value="all">Todas</option>
              <option value="mine">Mis conversaciones</option>
              <option value="unassigned">Sin asignar</option>
              <option value="others">Otros</option>
            </NativeSelect>
          </div>

          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversaciones"
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convLoading && conversations.length === 0 ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay conversaciones que coincidan con los filtros.
            </p>
          ) : (
            <ul>
              {conversations.map((conv) => {
                const name = displayName(conv);
                return (
                  <li key={conv.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(conv)}
                      className={cn(
                        "flex w-full items-center gap-3 border-b px-3 py-2.5 text-left hover:bg-muted/50",
                        selectedId === conv.id && "bg-muted",
                      )}
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback>{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {fmtTime(conv.lastMessageAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted-foreground">
                            {conv.lastMessageText ?? "—"}
                          </span>
                          {conv.unreadCount > 0 && (
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-[11px] font-medium text-white">
                              {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Panel central: hilo ──────────────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <ChatCircleTextIcon className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Selecciona una conversación para ver el hilo.
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback>
                    {initials(displayName(selected))}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {displayName(selected)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selected.phoneNumber ?? ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <NativeSelect
                  value={selected.assignedUser?.id ?? ""}
                  onChange={(e) => changeAssignment(e.target.value)}
                  aria-label="Asignar a"
                  className="w-40"
                >
                  <option value="">Sin asignar</option>
                  {(membersData?.members ?? []).map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  value={selected.notifyStatus}
                  onChange={(e) => changeStatus(e.target.value as NotifyStatusT)}
                  aria-label="Estado"
                  className="w-32"
                >
                  <option value="abierta">Abierta</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="cerrada">Cerrada</option>
                </NativeSelect>
              </div>
            </header>

            <div className="border-b bg-muted/30 px-4 py-2">
              {selected.windowOpen ? (
                <p className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-500">
                  <ClockIcon className="size-3.5" />
                  Ventana de servicio abierta
                  {fmtRemaining(selected.windowClosesAt)
                    ? ` — ${fmtRemaining(selected.windowClosesAt)}`
                    : ""}
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ClockIcon className="size-3.5" />
                  Ventana de 24h cerrada. Solo puedes enviar plantillas.
                </p>
              )}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto bg-muted/10 p-4">
              {msgLoading && messages.length === 0 ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-2/3" />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No hay mensajes en esta conversación.
                </p>
              ) : (
                messages.map((m) => <MessageBubble key={m.id} message={m} />)
              )}
            </div>

            {/* Composer: la Fase 1-2 son lectura/gestión; el envío llega en Fase 3. */}
            <footer className="border-t p-3">
              <Input
                disabled
                placeholder="El envío de mensajes estará disponible próximamente."
              />
            </footer>
          </>
        )}
      </section>

      {/* ── Panel derecho: contexto ──────────────────────────────────── */}
      {selected && (
        <aside className="hidden w-72 shrink-0 flex-col gap-4 border-l p-4 lg:flex">
          <div>
            <h3 className="mb-2 text-sm font-medium">Datos del contacto</h3>
            <dl className="space-y-1 text-sm">
              <InfoRow label="Nombre" value={displayName(selected)} />
              <InfoRow label="Teléfono" value={selected.phoneNumber ?? "—"} />
            </dl>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Datos de la conversación</h3>
            <dl className="space-y-1 text-sm">
              <InfoRow
                label="Estado"
                value={
                  STATUS_LABEL[selected.notifyStatus] ?? selected.notifyStatus
                }
              />
              <InfoRow
                label="Asignado a"
                value={selected.assignedUser?.name ?? "Sin asignar"}
              />
              <InfoRow
                label="Último entrante"
                value={
                  selected.lastInboundAt
                    ? new Date(selected.lastInboundAt).toLocaleString("es")
                    : "—"
                }
              />
            </dl>
          </div>
        </aside>
      )}

      {canConfigure && connectionId && (
        <SettingsDialog
          orgId={orgId}
          connectionId={connectionId}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}

function SettingsDialog({
  orgId,
  connectionId,
  open,
  onOpenChange,
}: {
  orgId: string;
  connectionId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const settingsUrl = `/api/v1/orgs/${orgId}/inbox/numbers/${connectionId}/settings`;
  const { data, mutate: mutateSettings } = useSWR<InboxSettingsDtoT>(
    open ? settingsUrl : null,
    fetcher,
  );

  const [saving, setSaving] = useState(false);
  const [reopen, setReopen] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<string | null>(null);

  const reopenValue = reopen ?? data?.reopenBehavior ?? "reopen_keep_agent";
  const receiptsValue =
    receipts ?? (data ? String(data.sendReadReceipts) : "true");

  async function save() {
    setSaving(true);
    try {
      await apiSend(settingsUrl, "PUT", {
        reopenBehavior: reopenValue,
        sendReadReceipts: receiptsValue === "true",
      });
      await mutateSettings();
      onOpenChange(false);
      setReopen(null);
      setReceipts(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configuración del número</DialogTitle>
          <DialogDescription>
            Define cómo se comporta el inbox de este número.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field>
            <FieldLabel>Reapertura ante un mensaje entrante</FieldLabel>
            <NativeSelect
              value={reopenValue}
              onChange={(e) => setReopen(e.target.value)}
            >
              <option value="reopen_keep_agent">
                Reabrir y mantener el agente
              </option>
              <option value="reopen_unassign">Reabrir sin asignar</option>
              <option value="stay_closed">Permanecer cerrada</option>
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel>Enviar acuse de lectura (✓✓ azul)</FieldLabel>
            <NativeSelect
              value={receiptsValue}
              onChange={(e) => setReceipts(e.target.value)}
            >
              <option value="true">Activado</option>
              <option value="false">Desactivado</option>
            </NativeSelect>
          </Field>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MessageBubble({ message }: { message: MessageDtoT }) {
  const outbound = message.direction === "outbound";
  const hasImage = message.type === "image" && message.mediaUrl;
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm",
          outbound
            ? "bg-green-600 text-white"
            : "bg-background text-foreground",
        )}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.mediaUrl!}
            alt={message.caption ?? "Imagen"}
            className="mb-1 max-h-60 rounded-md"
          />
        ) : message.mediaUrl ? (
          <a
            href={message.mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {message.filename ?? "Ver archivo adjunto"}
          </a>
        ) : null}
        {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
        {message.caption && (
          <p className="whitespace-pre-wrap">{message.caption}</p>
        )}
        {message.transcript && (
          <p className="mt-1 text-xs italic opacity-80">
            {message.transcript}
          </p>
        )}
        <div
          className={cn(
            "mt-1 text-right text-[10px]",
            outbound ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {fmtTime(message.timestamp)}
          {outbound && message.status ? ` · ${message.status}` : ""}
        </div>
      </div>
    </div>
  );
}
