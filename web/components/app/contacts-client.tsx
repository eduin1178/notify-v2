"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AddressBookIcon, PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";

import {
  createContactAction,
  deleteContactAction,
  updateContactAction,
  type ContactFormState,
} from "@/app/(app)/org/[orgSlug]/contacts/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import type { ContactDtoT } from "@/lib/services/contacts/schemas";

type FormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  company: string;
};

const EMPTY_FORM: FormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  company: "",
};

function toForm(contact: ContactDtoT): FormValues {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName ?? "",
    phone: contact.phone,
    email: contact.email ?? "",
    address: contact.address ?? "",
    city: contact.city ?? "",
    company: contact.company ?? "",
  };
}

type EditTarget = { mode: "new" } | { mode: "edit"; contact: ContactDtoT };

export function ContactsClient({
  orgSlug,
  contacts,
  page,
  pageSize,
  total,
}: {
  orgSlug: string;
  contacts: ContactDtoT[];
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startNavigation] = useTransition();

  const [target, setTarget] = useState<EditTarget | null>(null);
  const [deleting, setDeleting] = useState<ContactDtoT | null>(null);

  function navigate(next: { page?: number; pageSize?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.pageSize != null) {
      params.set("pageSize", String(next.pageSize));
      params.set("page", "1");
    }
    if (next.page != null) {
      params.set("page", String(next.page));
    }
    startNavigation(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <section className="flex flex-col gap-6 p-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <AddressBookIcon className="size-6" />
          <h1 className="text-xl font-semibold">Contactos</h1>
        </div>
        <Button size="sm" onClick={() => setTarget({ mode: "new" })}>
          Nuevo contacto
        </Button>
      </header>

      {contacts.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center text-card-foreground">
          <p className="text-sm text-muted-foreground">
            Aún no hay contactos. Crea el primero con &ldquo;Nuevo contacto&rdquo;.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Teléfono</th>
                <th className="px-3 py-2 font-medium">Correo</th>
                <th className="px-3 py-2 font-medium">Empresa</th>
                <th className="px-3 py-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {contact.firstName}
                    {contact.lastName ? ` ${contact.lastName}` : ""}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{contact.phone}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {contact.email ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {contact.company ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Editar ${contact.firstName}`}
                        onClick={() => setTarget({ mode: "edit", contact })}
                      >
                        <PencilSimpleIcon />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Eliminar ${contact.firstName}`}
                        onClick={() => setDeleting(contact)}
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        disabled={isNavigating}
        onPageChange={(p) => navigate({ page: p })}
        onPageSizeChange={(s) => navigate({ pageSize: s })}
      />

      {target ? (
        <ContactFormDialog
          orgSlug={orgSlug}
          target={target}
          onClose={() => setTarget(null)}
        />
      ) : null}

      {deleting ? (
        <DeleteContactDialog
          orgSlug={orgSlug}
          contact={deleting}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}

function ContactFormDialog({
  orgSlug,
  target,
  onClose,
}: {
  orgSlug: string;
  target: EditTarget;
  onClose: () => void;
}) {
  const isEdit = target.mode === "edit";
  const [values, setValues] = useState<FormValues>(
    isEdit ? toForm(target.contact) : EMPTY_FORM,
  );
  const [state, setState] = useState<ContactFormState>({});
  const [isPending, startSubmit] = useTransition();

  function update(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function submit() {
    setState({});
    startSubmit(async () => {
      const result = isEdit
        ? await updateContactAction(orgSlug, target.contact.id, values)
        : await createContactAction(orgSlug, values);
      if (result.ok) {
        onClose();
        return;
      }
      setState(result);
    });
  }

  return (
    <AlertDialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isEdit ? "Editar contacto" : "Nuevo contacto"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Los campos nombres, apellidos y teléfono son obligatorios. El teléfono
            debe estar en formato internacional, por ejemplo +573001234567.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="firstName"
            label="Nombres"
            value={values.firstName}
            error={state.fieldErrors?.firstName}
            onChange={(v) => update("firstName", v)}
          />
          <Field
            id="lastName"
            label="Apellidos"
            value={values.lastName}
            error={state.fieldErrors?.lastName}
            onChange={(v) => update("lastName", v)}
          />
          <Field
            id="phone"
            label="Teléfono"
            value={values.phone}
            placeholder="+573001234567"
            error={state.fieldErrors?.phone}
            onChange={(v) => update("phone", v)}
          />
          <Field
            id="email"
            label="Correo (opcional)"
            value={values.email}
            error={state.fieldErrors?.email}
            onChange={(v) => update("email", v)}
          />
          <Field
            id="company"
            label="Empresa (opcional)"
            value={values.company}
            error={state.fieldErrors?.company}
            onChange={(v) => update("company", v)}
          />
          <Field
            id="city"
            label="Ciudad (opcional)"
            value={values.city}
            error={state.fieldErrors?.city}
            onChange={(v) => update("city", v)}
          />
          <div className="sm:col-span-2">
            <Field
              id="address"
              label="Dirección (opcional)"
              value={values.address}
              error={state.fieldErrors?.address}
              onChange={(v) => update("address", v)}
            />
          </div>
        </div>

        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <Button size="sm" onClick={submit} disabled={isPending}>
            {isPending ? "Guardando…" : "Guardar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Field({
  id,
  label,
  value,
  placeholder,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function DeleteContactDialog({
  orgSlug,
  contact,
  onClose,
}: {
  orgSlug: string;
  contact: ContactDtoT;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startDelete] = useTransition();

  function confirm() {
    setError(null);
    startDelete(async () => {
      const result = await deleteContactAction(orgSlug, contact.id);
      if (result.ok) {
        onClose();
        return;
      }
      setError(result.error ?? "No se pudo eliminar el contacto.");
    });
  }

  return (
    <AlertDialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar contacto</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Seguro que quieres eliminar a {contact.firstName}
            {contact.lastName ? ` ${contact.lastName}` : ""}? Esta acción no se
            puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
            disabled={isPending}
          >
            {isPending ? "Eliminando…" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
