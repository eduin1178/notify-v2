"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { WhatsappLogoIcon } from "@phosphor-icons/react";

import {
  connectWhatsappAction,
  disconnectWhatsappAction,
  importWhatsappNumberAction,
  listImportableNumbersAction,
  reconnectWhatsappAction,
  renameWhatsappConnectionAction,
} from "@/app/(app)/org/[orgSlug]/whatsapp/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type {
  ImportablePhoneNumberDtoT,
  WhatsappConnectionDtoT,
} from "@/lib/services/whatsapp/schemas";

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
  disabled,
}: {
  children: React.ReactNode;
  variant?: "default" | "outline" | "destructive";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size="sm"
      disabled={pending || disabled}
    >
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

function ImportNumbersDialog({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [numbers, setNumbers] = useState<ImportablePhoneNumberDtoT[] | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isImporting, startImport] = useTransition();

  // Cargar la lista en el evento de apertura (no en un efecto).
  function openDialog() {
    setSelected("");
    setNumbers(null);
    setLoadError(null);
    setImportError(null);
    setOpen(true);
    startLoading(async () => {
      const res = await listImportableNumbersAction(orgSlug);
      if (res.ok) setNumbers(res.numbers);
      else setLoadError(res.error);
    });
  }

  function handleImport() {
    if (!selected) return;
    setImportError(null);
    startImport(async () => {
      const formData = new FormData();
      formData.set("orgSlug", orgSlug);
      formData.set("phoneNumberId", selected);
      const res = await importWhatsappNumberAction({}, formData);
      if (res.error) setImportError(res.error);
      else setOpen(false); // éxito: la lista se refresca por revalidatePath.
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog}>
        Importar número existente
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar número existente</AlertDialogTitle>
            <AlertDialogDescription>
              Agrega a Notify un número ya conectado en Kapso. Útil si la
              conexión se completó pero no se reflejó de forma automática.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="min-h-16">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Buscando números…</p>
            ) : loadError ? (
              <p className="text-sm text-destructive">{loadError}</p>
            ) : numbers && numbers.length > 0 ? (
              <RadioGroup
                value={selected}
                onValueChange={setSelected}
                className="gap-2"
              >
                {numbers.map((n) => (
                  <div key={n.phoneNumberId} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={n.phoneNumberId}
                      id={`imp-${n.phoneNumberId}`}
                    />
                    <Label
                      htmlFor={`imp-${n.phoneNumberId}`}
                      className="font-normal"
                    >
                      {n.name
                        ? `${n.name} (${n.displayPhoneNumber ?? n.phoneNumberId})`
                        : (n.displayPhoneNumber ?? n.phoneNumberId)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay números disponibles para importar.
              </p>
            )}
          </div>

          {importError ? (
            <p className="text-sm text-destructive">{importError}</p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!selected || isImporting}
            >
              {isImporting ? "Importando…" : "Importar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ConnectionCard({
  orgSlug,
  connection,
  canManage,
}: {
  orgSlug: string;
  connection: WhatsappConnectionDtoT;
  canManage: boolean;
}) {
  const [disconnectState, disconnectAction] = useActionState(
    disconnectWhatsappAction,
    {},
  );
  const [reconnectState, reconnectAction] = useActionState(
    reconnectWhatsappAction,
    {},
  );

  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(connection.name ?? "");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

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

  function startEdit() {
    setNameValue(connection.name ?? "");
    setRenameError(null);
    setEditing(true);
  }

  function saveName() {
    const name = nameValue.trim();
    if (!name) {
      setRenameError("El nombre no puede estar vacío.");
      return;
    }
    setRenameError(null);
    startSave(async () => {
      const formData = new FormData();
      formData.set("orgSlug", orgSlug);
      formData.set("connectionId", connection.id);
      formData.set("name", name);
      const res = await renameWhatsappConnectionAction({}, formData);
      if (res.error) setRenameError(res.error);
      else setEditing(false); // la lista se refresca por revalidatePath.
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {connection.name ??
            connection.displayPhoneNumber ??
            "Número por confirmar"}
        </CardTitle>
        <CardDescription>
          {connection.displayPhoneNumber
            ? `${connection.displayPhoneNumber} · `
            : ""}
          Estado: {STATUS_LABEL[connection.status]}
        </CardDescription>
      </CardHeader>

      {canManage ? (
        <CardContent className="flex flex-col gap-2">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                maxLength={60}
                placeholder="Nombre del número"
                className="h-7 w-48"
                aria-label="Nombre del número"
                autoFocus
              />
              <Button size="sm" onClick={saveName} disabled={isSaving}>
                {isSaving ? "Guardando…" : "Guardar"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={startEdit}>
                Editar nombre
              </Button>
              {canReconnect ? (
                <form action={reconnectAction}>
                  <input type="hidden" name="orgSlug" value={orgSlug} />
                  <input
                    type="hidden"
                    name="connectionId"
                    value={connection.id}
                  />
                  <SubmitButton variant="outline">Reconectar</SubmitButton>
                </form>
              ) : null}
              {showRemove ? (
                <form action={disconnectAction} className="ms-auto">
                  <input type="hidden" name="orgSlug" value={orgSlug} />
                  <input
                    type="hidden"
                    name="connectionId"
                    value={connection.id}
                  />
                  <SubmitButton variant={canCancel ? "outline" : "destructive"}>
                    {canCancel ? "Cancelar" : "Desconectar"}
                  </SubmitButton>
                </form>
              ) : null}
            </div>
          )}

          {renameError ? (
            <p className="text-sm text-destructive">{renameError}</p>
          ) : null}
          {disconnectState.error ? (
            <p className="text-sm text-destructive">{disconnectState.error}</p>
          ) : null}
          {reconnectState.error ? (
            <p className="text-sm text-destructive">{reconnectState.error}</p>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
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
        {canManage ? (
          <div className="flex items-start gap-2">
            <ImportNumbersDialog orgSlug={orgSlug} />
            <ConnectForm orgSlug={orgSlug} />
          </div>
        ) : null}
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
            <ConnectionCard
              key={connection.id}
              orgSlug={orgSlug}
              connection={connection}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
