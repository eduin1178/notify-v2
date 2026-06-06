"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Copy, Check, PaperPlaneTilt, Trash, X } from "@phosphor-icons/react";
import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  cancelInvitationAction,
  changeMemberRoleAction,
  deleteOrganizationAction,
  inviteMemberAction,
  removeMemberAction,
  transferOwnershipAction,
} from "@/app/(app)/org/[orgSlug]/members/actions";

type Role = "owner" | "admin" | "member";

type Member = {
  memberId: string;
  userId: string;
  role: Role;
  name: string;
  email: string;
  image: string | null | undefined;
};

type Invitation = {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  link: string;
};

type Props = {
  orgSlug: string;
  orgName: string;
  currentUserId: string;
  actorRole: Role;
  isSuperAdmin: boolean;
  canInvite: boolean;
  canDelete: boolean;
  canTransfer: boolean;
  members: Member[];
  pendingInvitations: Invitation[];
};

export function MembersClient(props: Props) {
  const otherOwners = props.members.filter(
    (m) => m.role === "owner" && m.userId !== props.currentUserId,
  );

  return (
    <section className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Miembros</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona quiénes pertenecen a {props.orgName} y sus roles.
        </p>
      </header>

      {props.canInvite ? <InviteForm orgSlug={props.orgSlug} /> : null}

      <div className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Miembros activos
        </h2>
        <ul className="divide-y divide-border border border-border">
          {props.members.map((m) => (
            <MemberRow
              key={m.memberId}
              orgSlug={props.orgSlug}
              member={m}
              isSelf={m.userId === props.currentUserId}
              actorRole={props.actorRole}
              isSuperAdmin={props.isSuperAdmin}
            />
          ))}
        </ul>
      </div>

      {props.pendingInvitations.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Invitaciones pendientes
          </h2>
          <ul className="divide-y divide-border border border-border">
            {props.pendingInvitations.map((inv) => (
              <InvitationRow key={inv.id} orgSlug={props.orgSlug} invitation={inv} />
            ))}
          </ul>
        </div>
      ) : null}

      {props.canTransfer && otherOwners.length === 0 && props.members.length > 1 ? (
        <TransferOwnershipDialog
          orgSlug={props.orgSlug}
          eligibleMembers={props.members.filter(
            (m) => m.userId !== props.currentUserId,
          )}
        />
      ) : null}

      {props.canDelete ? (
        <DeleteOrgDialog orgSlug={props.orgSlug} />
      ) : null}
    </section>
  );
}

function InviteForm({ orgSlug }: { orgSlug: string }) {
  const [state, action] = useActionState(inviteMemberAction, {});
  return (
    <form
      action={action}
      className="space-y-3 border border-border bg-card p-4 text-card-foreground"
    >
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <h2 className="text-sm font-medium">Invitar nuevo miembro</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" required placeholder="alguien@empresa.com" />
        </Field>
        <Field>
          <FieldLabel htmlFor="role">Rol</FieldLabel>
          <NativeSelect id="role" name="role" defaultValue="member">
            <option value="member">Miembro</option>
            <option value="admin">Administrador</option>
          </NativeSelect>
        </Field>
        <div className="flex items-end">
          <InviteSubmit />
        </div>
      </div>
      {state.ok ? (
        <p className="text-sm text-muted-foreground">Invitación enviada.</p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function InviteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <PaperPlaneTilt weight="bold" />
      {pending ? "Enviando..." : "Enviar invitación"}
    </Button>
  );
}

function MemberRow({
  orgSlug,
  member,
  isSelf,
  actorRole,
  isSuperAdmin,
}: {
  orgSlug: string;
  member: Member;
  isSelf: boolean;
  actorRole: Role;
  isSuperAdmin: boolean;
}) {
  const canChangeRole = canManage(actorRole, isSuperAdmin, member.role, isSelf);
  const canRemove = canManage(actorRole, isSuperAdmin, member.role, isSelf) && !isSelf;

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center bg-muted text-xs font-medium"
        >
          {initials(member.name)}
        </span>
        <div>
          <p className="text-sm font-medium">
            {member.name}
            {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(tú)</span> : null}
          </p>
          <p className="text-xs text-muted-foreground">{member.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canChangeRole ? (
          <ChangeRoleControl orgSlug={orgSlug} member={member} />
        ) : (
          <span className="text-sm text-muted-foreground">{roleLabel(member.role)}</span>
        )}
        {canRemove ? <RemoveMemberButton orgSlug={orgSlug} member={member} /> : null}
      </div>
    </li>
  );
}

function ChangeRoleControl({
  orgSlug,
  member,
}: {
  orgSlug: string;
  member: Member;
}) {
  const [state, action] = useActionState(changeMemberRoleAction, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="memberId" value={member.memberId} />
      <input type="hidden" name="currentRole" value={member.role} />
      <NativeSelect
        name="role"
        defaultValue={member.role}
        className="h-8 w-32 text-sm"
      >
        <option value="member">Miembro</option>
        <option value="admin">Administrador</option>
        <option value="owner">Propietario</option>
      </NativeSelect>
      <ChangeRoleSubmit />
      {state.error ? (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function ChangeRoleSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "..." : "Guardar"}
    </Button>
  );
}

function RemoveMemberButton({
  orgSlug,
  member,
}: {
  orgSlug: string;
  member: Member;
}) {
  const [state, action] = useActionState(removeMemberAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="memberId" value={member.memberId} />
      <input type="hidden" name="currentRole" value={member.role} />
      <RemoveSubmit />
      {state.error ? (
        <span role="alert" className="ml-2 text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function RemoveSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label="Remover miembro"
    >
      <Trash weight="bold" />
    </Button>
  );
}

function InvitationRow({
  orgSlug,
  invitation,
}: {
  orgSlug: string;
  invitation: Invitation;
}) {
  const [copied, setCopied] = useState(false);
  const [state, action] = useActionState(cancelInvitationAction, {});

  async function copyLink() {
    await navigator.clipboard.writeText(invitation.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">{invitation.email}</p>
        <p className="text-xs text-muted-foreground">
          Rol: {roleLabel(invitation.role)} · Expira{" "}
          {new Date(invitation.expiresAt).toLocaleDateString("es", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copyLink}>
          {copied ? <Check weight="bold" /> : <Copy weight="bold" />}
          {copied ? "Copiado" : "Copiar link"}
        </Button>
        <form action={action}>
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="invitationId" value={invitation.id} />
          <CancelInvitationSubmit />
        </form>
        {state.error ? (
          <span role="alert" className="text-xs text-destructive">
            {state.error}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function CancelInvitationSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="sm" disabled={pending} aria-label="Cancelar invitación">
      <X weight="bold" />
    </Button>
  );
}

function TransferOwnershipDialog({
  orgSlug,
  eligibleMembers,
}: {
  orgSlug: string;
  eligibleMembers: Member[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(transferOwnershipAction, {});

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline">
          Transferir propiedad
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
            "border border-border bg-background p-6 shadow-lg",
          )}
        >
          <Dialog.Title className="text-lg font-semibold">
            Transferir propiedad
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Pasarás a rol Administrador. La acción es inmediata y reversible solo por
            el nuevo propietario.
          </Dialog.Description>

          <form action={action} className="mt-4 space-y-4">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <Field>
              <FieldLabel htmlFor="memberId">Nuevo propietario</FieldLabel>
              <NativeSelect id="memberId" name="memberId" required>
                <option value="">Selecciona un miembro</option>
                {eligibleMembers.map((m) => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Dialog.Close>
              <TransferSubmit />
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TransferSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Transfiriendo..." : "Confirmar transferencia"}
    </Button>
  );
}

function DeleteOrgDialog({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteOrganizationAction, {});

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="destructive">
          Eliminar organización
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
            "border border-border bg-background p-6 shadow-lg",
          )}
        >
          <Dialog.Title className="text-lg font-semibold">
            Eliminar organización
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Esta acción es permanente. Se eliminarán todos los miembros, invitaciones y
            datos asociados.
          </Dialog.Description>

          <form action={action} className="mt-4 space-y-4">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <Field>
              <FieldLabel htmlFor="confirm">
                Escribe <code className="font-mono">{orgSlug}</code> para confirmar
              </FieldLabel>
              <Input id="confirm" name="confirm" type="text" required autoComplete="off" />
            </Field>
            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Dialog.Close>
              <DeleteSubmit />
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Eliminando..." : "Eliminar para siempre"}
    </Button>
  );
}

function canManage(
  actorRole: Role,
  isSuperAdmin: boolean,
  targetRole: Role,
  isSelf: boolean,
): boolean {
  if (isSuperAdmin) return true;
  if (isSelf && targetRole === "owner") return false;
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return targetRole === "member";
  return false;
}

function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function roleLabel(role: Role): string {
  switch (role) {
    case "owner":
      return "Propietario";
    case "admin":
      return "Administrador";
    case "member":
      return "Miembro";
  }
}
