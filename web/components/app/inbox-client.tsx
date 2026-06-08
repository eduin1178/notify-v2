"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import {
  ChatCircleTextIcon,
  CheckIcon,
  ChecksIcon,
  ClockIcon,
  DownloadSimpleIcon,
  GearSixIcon,
  InfoIcon,
  ListBulletsIcon,
  MagnifyingGlassIcon,
  PaperclipIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  TemplatesResponseT,
} from "@/lib/services/inbox/schemas";

import type { ContactDtoT } from "@/lib/services/contacts/schemas";

import { Composer } from "./inbox/composer";
import {
  sendMessageRequest,
  sendMessageRequestJson,
} from "./inbox/send-helpers";
import { useAttachmentDraft } from "./inbox/use-attachment-draft";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [connectionId, setConnectionId] = useState<string | null>(
    initialConnectionId,
  );
  const [tab, setTab] = useState<Tab>("todas");
  const [status, setStatus] = useState<StatusFilter>("");
  const [assignment, setAssignment] = useState<AssignmentFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templateTarget, setTemplateTarget] = useState<{
    conversationId: string;
    connectionId: string;
  } | null>(null);
  const [interactiveConvId, setInteractiveConvId] = useState<string | null>(
    null,
  );
  const [newConvOpen, setNewConvOpen] = useState(false);
  // Panel de información: oculto por defecto, se conmuta desde la cabecera.
  const [infoOpen, setInfoOpen] = useState(false);
  // Borrador de adjunto del composer (compartido con el arrastrar y soltar).
  const draft = useAttachmentDraft();
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const handledStartRef = useRef(false);

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

  const afterSend = () => {
    revalidate();
    if (messagesKey) mutate(messagesKey);
  };

  /** Lleva el foco a una conversación recién iniciada (resetea filtros). */
  function focusConversation(conv: ConversationDtoT) {
    resetDraft();
    setConnectionId(conv.connectionId);
    setStatus("");
    setAssignment("all");
    setTab("todas");
    setSearch("");
    setSelectedId(conv.id);
    revalidate();
  }

  // Deep-link "Iniciar conversación" desde la lista de contactos
  // (`?startContact=<id>`): crea/recupera la conversación, la enfoca y, como una
  // conversación proactiva nace sin ventana, abre el diálogo de plantilla.
  useEffect(() => {
    const startContact = searchParams.get("startContact");
    if (!startContact || !connectionId || handledStartRef.current) return;
    handledStartRef.current = true;
    (async () => {
      try {
        const conv = (await apiSend(
          `/api/v1/orgs/${orgId}/inbox/conversations`,
          "POST",
          { connectionId, contactId: startContact, kind: "template" },
        )) as ConversationDtoT | null;
        if (conv?.id) {
          focusConversation(conv);
          if (!conv.windowOpen) {
            setTemplateTarget({
              conversationId: conv.id,
              connectionId: conv.connectionId,
            });
          }
        }
      } catch {
        // Silencioso: si falla, el usuario puede iniciar manualmente.
      }
      router.replace(pathname);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, connectionId, orgId]);

  /** Descarta el borrador de adjunto al cambiar de conversación o número. */
  function resetDraft() {
    draft.clear();
    setDragging(false);
    dragCounter.current = 0;
  }

  /** ¿El arrastre trae archivos y la ventana de 24h está abierta? */
  function canDropFiles(e: React.DragEvent): boolean {
    return (
      !!selected?.windowOpen &&
      Array.from(e.dataTransfer.types).includes("Files")
    );
  }

  function onThreadDragEnter(e: React.DragEvent) {
    if (!canDropFiles(e)) return;
    e.preventDefault();
    dragCounter.current += 1;
    setDragging(true);
  }

  function onThreadDragOver(e: React.DragEvent) {
    if (canDropFiles(e)) e.preventDefault();
  }

  function onThreadDragLeave() {
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragging(false);
  }

  function onThreadDrop(e: React.DragEvent) {
    dragCounter.current = 0;
    setDragging(false);
    if (!selected?.windowOpen) return;
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) draft.addFiles(e.dataTransfer.files);
  }

  function selectConversation(conv: ConversationDtoT) {
    if (conv.id !== selectedId) resetDraft();
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
                resetDraft();
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
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setNewConvOpen(true)}
              aria-label="Nueva conversación"
            >
              <PlusIcon />
            </Button>
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

        <ScrollArea className="min-h-0 flex-1">
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
        </ScrollArea>
      </aside>

      {/* ── Panel central: hilo ──────────────────────────────────────── */}
      <section
        className="relative flex min-w-0 flex-1 flex-col"
        onDragEnter={onThreadDragEnter}
        onDragOver={onThreadDragOver}
        onDragLeave={onThreadDragLeave}
        onDrop={onThreadDrop}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed border-primary bg-background/80">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <PaperclipIcon className="size-5" />
              Suelta para adjuntar
            </p>
          </div>
        )}
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
                <button
                  type="button"
                  onClick={() => setInfoOpen((v) => !v)}
                  className="min-w-0 text-left"
                  aria-label="Ver datos del contacto"
                >
                  <p className="truncate text-sm font-medium hover:underline">
                    {displayName(selected)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selected.phoneNumber ?? ""}
                  </p>
                </button>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant={infoOpen ? "secondary" : "outline"}
                  size="icon"
                  onClick={() => setInfoOpen((v) => !v)}
                  aria-label="Información de la conversación"
                  aria-pressed={infoOpen}
                >
                  <InfoIcon />
                </Button>
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

            <ScrollArea className="min-h-0 flex-1 bg-muted/10">
              <div className="space-y-2 p-4">
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
            </ScrollArea>

            <Composer
              orgId={orgId}
              conversation={selected}
              draft={draft}
              onSent={afterSend}
              onOpenTemplate={() =>
                setTemplateTarget({
                  conversationId: selected.id,
                  connectionId: selected.connectionId,
                })
              }
              onOpenInteractive={() => setInteractiveConvId(selected.id)}
            />
          </>
        )}
      </section>

      {/* ── Panel derecho: contexto (oculto por defecto) ─────────────── */}
      {selected && infoOpen && (
        <aside className="flex w-72 shrink-0 flex-col border-l">
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-4 p-4">
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
            </div>
          </ScrollArea>
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

      {templateTarget && (
        <TemplateDialog
          orgId={orgId}
          connectionId={templateTarget.connectionId}
          conversationId={templateTarget.conversationId}
          open
          onOpenChange={(v) => {
            if (!v) setTemplateTarget(null);
          }}
          onSent={afterSend}
        />
      )}

      {interactiveConvId && (
        <InteractiveDialog
          orgId={orgId}
          conversationId={interactiveConvId}
          open
          onOpenChange={(v) => {
            if (!v) setInteractiveConvId(null);
          }}
          onSent={afterSend}
        />
      )}

      {connectionId && (
        <StartConversationDialog
          orgId={orgId}
          connectionId={connectionId}
          open={newConvOpen}
          onOpenChange={setNewConvOpen}
          onStarted={(conv) => {
            focusConversation(conv);
            if (!conv.windowOpen) {
              setTemplateTarget({
                conversationId: conv.id,
                connectionId: conv.connectionId,
              });
            }
          }}
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

const MEDIA_HEADER = new Set(["IMAGE", "VIDEO", "DOCUMENT"]);

function variableLabel(key: string, named: boolean): string {
  return named ? key : `Variable ${key}`;
}

const TEMPLATE_STATUS_LABEL: Record<string, string> = {
  APPROVED: "Aprobada",
  PENDING: "Pendiente",
  REJECTED: "Rechazada",
};

function templateStatusLabel(status: string | null): string {
  if (!status) return "";
  return TEMPLATE_STATUS_LABEL[status.toUpperCase()] ?? status;
}

function TemplateDialog({
  orgId,
  connectionId,
  conversationId,
  open,
  onOpenChange,
  onSent,
}: {
  orgId: string;
  connectionId: string;
  conversationId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState("");
  const { data, isLoading } = useSWR<TemplatesResponseT>(
    open
      ? `/api/v1/orgs/${orgId}/inbox/numbers/${connectionId}/templates${
          statusFilter ? `?status=${statusFilter}` : ""
        }`
      : null,
    fetcher,
  );

  const templates = data?.templates ?? [];
  const [selectedKey, setSelectedKey] = useState("");
  const [bodyVars, setBodyVars] = useState<Record<string, string>>({});
  const [headerVars, setHeaderVars] = useState<Record<string, string>>({});
  const [headerMediaUrl, setHeaderMediaUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = templates.find(
    (t) => `${t.name}::${t.language}` === selectedKey,
  );
  const named = selected?.parameterFormat === "named";
  const isMediaHeader = selected?.headerFormat
    ? MEDIA_HEADER.has(selected.headerFormat)
    : false;
  const notApproved =
    !!selected && (selected.status ?? "").toUpperCase() !== "APPROVED";

  function reset() {
    setSelectedKey("");
    setBodyVars({});
    setHeaderVars({});
    setHeaderMediaUrl(null);
    setError(null);
  }

  async function uploadHeaderMedia(file: File) {
    setBusy(true);
    setError(null);
    try {
      const contentType = file.type || "application/octet-stream";
      const presign = (await sendMessageRequestJson(
        `/api/v1/orgs/${orgId}/inbox/uploads`,
        { contentType, size: file.size, filename: file.name },
      )) as { uploadUrl: string; publicUrl: string };
      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!put.ok) throw new Error("No se pudo subir el archivo.");
      setHeaderMediaUrl(presign.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el archivo.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function send() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await sendMessageRequest(
        `/api/v1/orgs/${orgId}/inbox/conversations/${conversationId}/template`,
        {
          templateName: selected.name,
          language: selected.language,
          bodyVariables: bodyVars,
          headerVariables: headerVars,
          ...(headerMediaUrl ? { headerMediaUrl } : {}),
        },
      );
      reset();
      onOpenChange(false);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la plantilla.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar plantilla</DialogTitle>
          <DialogDescription>
            Elige una plantilla aprobada y completa sus variables.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <WarningCircleIcon className="size-3.5" />
              {error}
            </p>
          )}

          <Field>
            <FieldLabel>Estado</FieldLabel>
            <NativeSelect
              value={statusFilter}
              disabled={busy}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSelectedKey("");
              }}
            >
              <option value="">Todas</option>
              <option value="APPROVED">Aprobadas</option>
              <option value="PENDING">Pendientes</option>
              <option value="REJECTED">Rechazadas</option>
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel>Plantilla</FieldLabel>
            <NativeSelect
              value={selectedKey}
              disabled={isLoading || busy}
              onChange={(e) => {
                setSelectedKey(e.target.value);
                setBodyVars({});
                setHeaderVars({});
                setHeaderMediaUrl(null);
              }}
            >
              <option value="">
                {isLoading
                  ? "Cargando plantillas…"
                  : templates.length === 0
                    ? "No hay plantillas para este filtro"
                    : "Selecciona una plantilla"}
              </option>
              {templates.map((t) => (
                <option key={`${t.name}::${t.language}`} value={`${t.name}::${t.language}`}>
                  {t.name} ({t.language})
                  {` · ${templateStatusLabel(t.status)}`}
                  {t.category ? ` · ${t.category}` : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>

          {notApproved && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Esta plantilla está {templateStatusLabel(selected?.status ?? null).toLowerCase()}.
              Solo puedes enviar plantillas aprobadas por WhatsApp.
            </p>
          )}

          {selected?.bodyText && (
            <p className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {selected.bodyText}
            </p>
          )}

          {selected?.headerFormat === "TEXT" &&
            selected.headerVariables.map((key) => (
              <Field key={`h-${key}`}>
                <FieldLabel>Cabecera · {variableLabel(key, named)}</FieldLabel>
                <Input
                  value={headerVars[key] ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    setHeaderVars((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              </Field>
            ))}

          {isMediaHeader && (
            <Field>
              <FieldLabel>
                Archivo de cabecera ({selected?.headerFormat?.toLowerCase()})
              </FieldLabel>
              <input
                ref={fileRef}
                type="file"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadHeaderMedia(file);
                }}
              />
              {headerMediaUrl && (
                <p className="text-xs text-green-700 dark:text-green-500">
                  Archivo cargado.
                </p>
              )}
            </Field>
          )}

          {selected?.bodyVariables.map((key) => (
            <Field key={`b-${key}`}>
              <FieldLabel>{variableLabel(key, named)}</FieldLabel>
              <Input
                value={bodyVars[key] ?? ""}
                disabled={busy}
                onChange={(e) =>
                  setBodyVars((v) => ({ ...v, [key]: e.target.value }))
                }
              />
            </Field>
          ))}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={send}
            disabled={
              busy ||
              !selected ||
              notApproved ||
              (isMediaHeader && !headerMediaUrl)
            }
          >
            {busy ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StartConversationDialog({
  orgId,
  connectionId,
  open,
  onOpenChange,
  onStarted,
}: {
  orgId: string;
  connectionId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStarted: (conv: ConversationDtoT) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce del término de búsqueda de contactos.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const { data: contactsData, isLoading } = useSWR<{ items: ContactDtoT[] }>(
    open && debounced
      ? `/api/v1/orgs/${orgId}/contacts?pageSize=8&search=${encodeURIComponent(debounced)}`
      : null,
    fetcher,
  );
  const contacts = contactsData?.items ?? [];

  function reset() {
    setQuery("");
    setDebounced("");
    setPhone("");
    setError(null);
  }

  /** Crea/recupera la conversación por contacto o por teléfono manual. */
  async function start(payload: { contactId: string } | { phone: string }) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const conv = (await sendMessageRequestJson(
        `/api/v1/orgs/${orgId}/inbox/conversations`,
        { connectionId, kind: "template", ...payload },
      )) as ConversationDtoT;
      reset();
      onOpenChange(false);
      onStarted(conv);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo iniciar la conversación.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar conversación</DialogTitle>
          <DialogDescription>
            Busca un contacto por nombre o teléfono. Si no tiene una ventana de
            24 horas abierta, deberás enviar una plantilla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <WarningCircleIcon className="size-3.5" />
              {error}
            </p>
          )}

          <Field>
            <FieldLabel>Buscar contacto</FieldLabel>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                disabled={busy}
                placeholder="Nombre o teléfono"
                className="pl-8"
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
          </Field>

          {debounced && (
            <div className="max-h-56 overflow-y-auto rounded-md border">
              {isLoading ? (
                <p className="p-3 text-center text-xs text-muted-foreground">
                  Buscando…
                </p>
              ) : contacts.length === 0 ? (
                <p className="p-3 text-center text-xs text-muted-foreground">
                  No hay contactos que coincidan.
                </p>
              ) : (
                <ul>
                  {contacts.map((c) => {
                    const name = `${c.firstName} ${c.lastName ?? ""}`.trim();
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => start({ contactId: c.id })}
                          className="flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50 disabled:opacity-60"
                        >
                          <Avatar className="size-8 shrink-0">
                            <AvatarFallback>{initials(name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {c.phone}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <Field>
            <FieldLabel>¿No está en tus contactos? Escribe el teléfono</FieldLabel>
            <Input
              value={phone}
              disabled={busy}
              placeholder="+521234567890"
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && phone.trim()) {
                  e.preventDefault();
                  start({ phone: phone.trim() });
                }
              }}
            />
          </Field>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() => start({ phone: phone.trim() })}
            disabled={busy || !phone.trim()}
          >
            {busy ? "Iniciando…" : "Iniciar por teléfono"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InteractiveDialog({
  orgId,
  conversationId,
  open,
  onOpenChange,
  onSent,
}: {
  orgId: string;
  conversationId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent: () => void;
}) {
  const [type, setType] = useState<"button" | "list" | "cta_url">("button");
  const [bodyText, setBodyText] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<string[]>([""]);
  const [buttonLabel, setButtonLabel] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [rows, setRows] = useState<{ title: string; description: string }[]>([
    { title: "", description: "" },
  ]);
  const [ctaDisplayText, setCtaDisplayText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setType("button");
    setBodyText("");
    setHeaderText("");
    setFooterText("");
    setButtons([""]);
    setButtonLabel("");
    setSectionTitle("");
    setRows([{ title: "", description: "" }]);
    setCtaDisplayText("");
    setCtaUrl("");
    setError(null);
  }

  async function send() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        interactiveType: type,
        bodyText: bodyText.trim(),
        ...(headerText.trim() ? { headerText: headerText.trim() } : {}),
        ...(footerText.trim() ? { footerText: footerText.trim() } : {}),
      };

      if (type === "button") {
        payload.buttons = buttons
          .map((t, i) => ({ id: `btn_${i + 1}`, title: t.trim() }))
          .filter((b) => b.title);
      } else if (type === "list") {
        payload.buttonLabel = buttonLabel.trim();
        const validRows = rows
          .map((r, i) => ({
            id: `row_${i + 1}`,
            title: r.title.trim(),
            ...(r.description.trim()
              ? { description: r.description.trim() }
              : {}),
          }))
          .filter((r) => r.title);
        payload.sections = [
          {
            ...(sectionTitle.trim() ? { title: sectionTitle.trim() } : {}),
            rows: validRows,
          },
        ];
      } else {
        payload.ctaDisplayText = ctaDisplayText.trim();
        payload.ctaUrl = ctaUrl.trim();
      }

      await sendMessageRequest(
        `/api/v1/orgs/${orgId}/inbox/conversations/${conversationId}/interactive`,
        payload,
      );
      reset();
      onOpenChange(false);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el mensaje.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mensaje interactivo</DialogTitle>
          <DialogDescription>
            Envía botones de respuesta, una lista de opciones o un botón con
            enlace. Solo dentro de la ventana de 24 horas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <WarningCircleIcon className="size-3.5" />
              {error}
            </p>
          )}

          <Field>
            <FieldLabel>Tipo</FieldLabel>
            <NativeSelect
              value={type}
              disabled={busy}
              onChange={(e) =>
                setType(e.target.value as "button" | "list" | "cta_url")
              }
            >
              <option value="button">Botones de respuesta</option>
              <option value="list">Lista de opciones</option>
              <option value="cta_url">Botón con enlace</option>
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel>Encabezado (opcional)</FieldLabel>
            <Input
              value={headerText}
              disabled={busy}
              maxLength={60}
              onChange={(e) => setHeaderText(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>Mensaje</FieldLabel>
            <Input
              value={bodyText}
              disabled={busy}
              maxLength={1024}
              placeholder="Texto principal del mensaje"
              onChange={(e) => setBodyText(e.target.value)}
            />
          </Field>

          {type === "button" && (
            <div className="space-y-2">
              <FieldLabel>Botones (máx. 3)</FieldLabel>
              {buttons.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={b}
                    disabled={busy}
                    maxLength={20}
                    placeholder={`Botón ${i + 1}`}
                    onChange={(e) =>
                      setButtons((prev) =>
                        prev.map((v, j) => (j === i ? e.target.value : v)),
                      )
                    }
                  />
                  {buttons.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={busy}
                      aria-label="Quitar botón"
                      onClick={() =>
                        setButtons((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      <TrashIcon />
                    </Button>
                  )}
                </div>
              ))}
              {buttons.length < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setButtons((prev) => [...prev, ""])}
                >
                  <PlusIcon /> Añadir botón
                </Button>
              )}
            </div>
          )}

          {type === "list" && (
            <div className="space-y-3">
              <Field>
                <FieldLabel>Texto del botón de la lista</FieldLabel>
                <Input
                  value={buttonLabel}
                  disabled={busy}
                  maxLength={20}
                  placeholder="Ver opciones"
                  onChange={(e) => setButtonLabel(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Título de la sección (opcional)</FieldLabel>
                <Input
                  value={sectionTitle}
                  disabled={busy}
                  maxLength={24}
                  onChange={(e) => setSectionTitle(e.target.value)}
                />
              </Field>
              <div className="space-y-2">
                <FieldLabel>Opciones (máx. 10)</FieldLabel>
                {rows.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                      <Input
                        value={r.title}
                        disabled={busy}
                        maxLength={24}
                        placeholder={`Opción ${i + 1}`}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((v, j) =>
                              j === i ? { ...v, title: e.target.value } : v,
                            ),
                          )
                        }
                      />
                      <Input
                        value={r.description}
                        disabled={busy}
                        maxLength={72}
                        placeholder="Descripción (opcional)"
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((v, j) =>
                              j === i
                                ? { ...v, description: e.target.value }
                                : v,
                            ),
                          )
                        }
                      />
                    </div>
                    {rows.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={busy}
                        aria-label="Quitar opción"
                        onClick={() =>
                          setRows((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        <TrashIcon />
                      </Button>
                    )}
                  </div>
                ))}
                {rows.length < 10 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      setRows((prev) => [...prev, { title: "", description: "" }])
                    }
                  >
                    <PlusIcon /> Añadir opción
                  </Button>
                )}
              </div>
            </div>
          )}

          {type === "cta_url" && (
            <>
              <Field>
                <FieldLabel>Texto del botón</FieldLabel>
                <Input
                  value={ctaDisplayText}
                  disabled={busy}
                  maxLength={20}
                  placeholder="Abrir enlace"
                  onChange={(e) => setCtaDisplayText(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>URL</FieldLabel>
                <Input
                  value={ctaUrl}
                  disabled={busy}
                  placeholder="https://…"
                  onChange={(e) => setCtaUrl(e.target.value)}
                />
              </Field>
            </>
          )}

          <Field>
            <FieldLabel>Pie (opcional)</FieldLabel>
            <Input
              value={footerText}
              disabled={busy}
              maxLength={60}
              onChange={(e) => setFooterText(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={send} disabled={busy || !bodyText.trim()}>
            {busy ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DELIVERY_LABEL: Record<string, string> = {
  pending: "Pendiente",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Fallido",
};

/** Marca de entrega para mensajes salientes (✓ / ✓✓ / leído / fallido). */
function DeliveryStatus({ status }: { status: string | null }) {
  if (!status) return null;
  const label = DELIVERY_LABEL[status] ?? status;
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-200">
        <WarningCircleIcon className="size-3" /> {label}
      </span>
    );
  }
  if (status === "read" || status === "delivered") {
    return (
      <span className="inline-flex items-center gap-0.5">
        <ChecksIcon className={cn("size-3", status === "read" && "text-sky-300")} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <CheckIcon className="size-3" />
    </span>
  );
}

const MEDIA_TYPE_LABEL: Record<string, string> = {
  image: "Imagen",
  video: "Video",
  audio: "Audio",
  document: "Documento",
};

/** Enlace de descarga con ícono (no muestra la URL cruda). */
function DownloadLink({
  url,
  label,
  outbound,
}: {
  url: string;
  label: string;
  outbound: boolean;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download
      className={cn(
        "inline-flex items-center gap-1.5 text-xs underline-offset-2 hover:underline",
        outbound ? "text-white/90" : "text-foreground",
      )}
    >
      <DownloadSimpleIcon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </a>
  );
}

function MessageMedia({
  message,
  outbound,
}: {
  message: MessageDtoT;
  outbound: boolean;
}) {
  if (!message.mediaUrl) return null;
  const url = message.mediaUrl;

  if (message.type === "image") {
    return (
      <div className="mb-1 space-y-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={message.caption ?? "Imagen"}
          className="max-h-60 rounded-md"
        />
        <DownloadLink url={url} label="Descargar imagen" outbound={outbound} />
      </div>
    );
  }
  if (message.type === "video") {
    return (
      <div className="mb-1 space-y-1">
        <video src={url} controls className="max-h-60 rounded-md" />
        <DownloadLink url={url} label="Descargar video" outbound={outbound} />
      </div>
    );
  }
  if (message.type === "audio") {
    return (
      <div className="mb-1 space-y-1">
        <audio src={url} controls className="w-full" />
        <DownloadLink url={url} label="Descargar audio" outbound={outbound} />
      </div>
    );
  }
  // Documento u otros: tarjeta con ícono de descarga (sin URL visible).
  const label =
    message.filename ?? MEDIA_TYPE_LABEL[message.type] ?? "Archivo";
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download
      className={cn(
        "mb-1 flex items-center gap-2 rounded-md border px-2.5 py-2",
        outbound
          ? "border-white/30 hover:bg-white/10"
          : "border-border hover:bg-muted",
      )}
    >
      <DownloadSimpleIcon className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
    </a>
  );
}

/** ¿El mensaje es interactivo (enviado o respuesta entrante)? */
function isInteractive(message: MessageDtoT): boolean {
  return message.type === "interactive" || message.type === "button";
}

function MessageBubble({ message }: { message: MessageDtoT }) {
  const outbound = message.direction === "outbound";
  // En mensajes con media nunca se pinta `text` (el caption real va en
  // `caption`); evita que descripciones autogeneradas o URLs rompan la burbuja.
  const showText = message.text && !message.mediaUrl;
  const interactiveReply = !outbound && isInteractive(message);
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
        <MessageMedia message={message} outbound={outbound} />
        {interactiveReply && (
          <span className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <ListBulletsIcon className="size-3" /> Respuesta
          </span>
        )}
        {showText && <p className="whitespace-pre-wrap">{message.text}</p>}
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
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            outbound ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {fmtTime(message.timestamp)}
          {outbound && <DeliveryStatus status={message.status} />}
        </div>
      </div>
    </div>
  );
}
