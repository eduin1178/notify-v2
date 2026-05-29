"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { WhatsappLogoIcon } from "@phosphor-icons/react";

import {
  connectWhatsappAction,
  disconnectWhatsappAction,
  reconnectWhatsappAction,
} from "@/app/(app)/org/[orgSlug]/whatsapp/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WhatsappConnectionDtoT } from "@/lib/services/whatsapp/schemas";

type Status = WhatsappConnectionDtoT["status"];

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pendiente",
  connected: "Conectado",
  disconnected: "Desconectado",
  needs_reconnect: "Requiere reconexión",
  failed: "Fallida",
};

function SubmitButton({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "default" | "outline" | "destructive";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      {pending ? "Procesando…" : children}
    </Button>
  );
}

function ConnectForm({ orgSlug }: { orgSlug: string }) {
  const [state, formAction] = useActionState(connectWhatsappAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <SubmitButton>Conectar WhatsApp</SubmitButton>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

function ConnectionActions({
  orgSlug,
  connection,
}: {
  orgSlug: string;
  connection: WhatsappConnectionDtoT;
}) {
  const [disconnectState, disconnectAction] = useActionState(
    disconnectWhatsappAction,
    {},
  );
  const [reconnectState, reconnectAction] = useActionState(
    reconnectWhatsappAction,
    {},
  );

  const canReconnect =
    Boolean(connection.phoneNumberId) &&
    (connection.status === "needs_reconnect" ||
      connection.status === "disconnected");
  // Número real en uso → "Desconectar"; intento sin número → "Cancelar".
  const canDisconnect =
    connection.status === "connected" ||
    connection.status === "needs_reconnect";
  const canCancel =
    connection.status === "pending" || connection.status === "failed";
  const showRemove = canDisconnect || canCancel;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canReconnect ? (
          <form action={reconnectAction}>
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="connectionId" value={connection.id} />
            <SubmitButton variant="outline">Reconectar</SubmitButton>
          </form>
        ) : null}
        {showRemove ? (
          <form action={disconnectAction}>
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="connectionId" value={connection.id} />
            <SubmitButton variant={canCancel ? "outline" : "destructive"}>
              {canCancel ? "Cancelar" : "Desconectar"}
            </SubmitButton>
          </form>
        ) : null}
      </div>
      {disconnectState.error ? (
        <p className="text-sm text-destructive">{disconnectState.error}</p>
      ) : null}
      {reconnectState.error ? (
        <p className="text-sm text-destructive">{reconnectState.error}</p>
      ) : null}
    </div>
  );
}

export function WhatsappClient({
  orgSlug,
  canManage,
  connections,
}: {
  orgSlug: string;
  canManage: boolean;
  connections: WhatsappConnectionDtoT[];
}) {
  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <WhatsappLogoIcon className="size-6" />
          <h1 className="text-xl font-semibold">Cuentas de WhatsApp</h1>
        </div>
        {canManage ? <ConnectForm orgSlug={orgSlug} /> : null}
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aún no hay cuentas conectadas</CardTitle>
            <CardDescription>
              {canManage
                ? "Conecta una cuenta de WhatsApp para empezar a enviar mensajes desde tu organización."
                : "Un propietario o administrador debe conectar la primera cuenta de WhatsApp."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {connections.map((connection) => (
            <Card key={connection.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {connection.displayPhoneNumber ?? "Número por confirmar"}
                </CardTitle>
                <CardDescription>
                  Estado: {STATUS_LABEL[connection.status]}
                </CardDescription>
              </CardHeader>
              {canManage ? (
                <CardContent>
                  <ConnectionActions
                    orgSlug={orgSlug}
                    connection={connection}
                  />
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
