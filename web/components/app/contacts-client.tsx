"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AddressBookIcon,
  DownloadSimpleIcon,
  PencilSimpleIcon,
  TagIcon,
  TrashIcon,
  UploadSimpleIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react";

import {
  createContactAction,
  createTagAction,
  deleteContactAction,
  deleteTagAction,
  exportContactsCsvAction,
  importContactsCsvAction,
  importFromWhatsappAction,
  listConnectedWhatsappAction,
  setContactTagsAction,
  updateContactAction,
  type ConnectedNumber,
  type ContactFormState,
  type ImportCsvState,
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import type { ContactDtoT, TagDtoT } from "@/lib/services/contacts/schemas";

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
  availableTags,
  activeTagId,
}: {
  orgSlug: string;
  contacts: ContactDtoT[];
  page: number;
  pageSize: number;
  total: number;
  availableTags: TagDtoT[];
  activeTagId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startNavigation] = useTransition();

  const [target, setTarget] = useState<EditTarget | null>(null);
  const [deleting, setDeleting] = useState<ContactDtoT | null>(null);
  const [managingTags, setManagingTags] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingWhatsapp, setImportingWhatsapp] = useState(false);
  const [isExporting, startExport] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  function handleExport() {
    setExportError(null);
    startExport(async () => {
      const result = await exportContactsCsvAction(orgSlug);
      if (!result.ok) {
        setExportError(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "contactos.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    });
  }

  function navigate(next: { page?: number; pageSize?: number; tagId?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.pageSize != null) {
      params.set("pageSize", String(next.pageSize));
      params.set("page", "1");
    }
    if (next.tagId !== undefined) {
      if (next.tagId) params.set("tagId", next.tagId);
      else params.delete("tagId");
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
          >
            <DownloadSimpleIcon />
            {isExporting ? "Exportando…" : "Exportar CSV"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImporting(true)}
          >
            <UploadSimpleIcon />
            Importar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportingWhatsapp(true)}
          >
            <WhatsappLogoIcon />
            Importar de WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManagingTags(true)}
          >
            <TagIcon />
            Gestionar etiquetas
          </Button>
          <Button size="sm" onClick={() => setTarget({ mode: "new" })}>
            Nuevo contacto
          </Button>
        </div>
      </header>

      {exportError ? (
        <p className="text-sm text-destructive">{exportError}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="tag-filter" className="text-sm text-muted-foreground">
          Filtrar por etiqueta
        </Label>
        <NativeSelect
          id="tag-filter"
          className="h-7 w-56"
          value={activeTagId ?? ""}
          disabled={isNavigating}
          onChange={(e) => navigate({ tagId: e.target.value || null })}
        >
          <option value="">Todas las etiquetas</option>
          {availableTags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {contacts.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center text-card-foreground">
          <p className="text-sm text-muted-foreground">
            {activeTagId
              ? "No hay contactos con esta etiqueta."
              : "Aún no hay contactos. Crea el primero con “Nuevo contacto”."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Teléfono</th>
                <th className="px-3 py-2 font-medium">Etiquetas</th>
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
                  <td className="px-3 py-2">
                    {contact.tags.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
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
          availableTags={availableTags}
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

      {managingTags ? (
        <ManageTagsDialog
          orgSlug={orgSlug}
          tags={availableTags}
          onClose={() => setManagingTags(false)}
        />
      ) : null}

      {importing ? (
        <ImportCsvDialog orgSlug={orgSlug} onClose={() => setImporting(false)} />
      ) : null}

      {importingWhatsapp ? (
        <ImportWhatsappDialog
          orgSlug={orgSlug}
          onClose={() => setImportingWhatsapp(false)}
        />
      ) : null}
    </section>
  );
}

function ImportWhatsappDialog({
  orgSlug,
  onClose,
}: {
  orgSlug: string;
  onClose: () => void;
}) {
  const [connections, setConnections] = useState<ConnectedNumber[] | null>(null);
  const [selected, setSelected] = useState("");
  const [report, setReport] = useState<{
    imported: number;
    skippedNoPhone: number;
    skippedDuplicate: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoad] = useTransition();
  const [isImporting, startImport] = useTransition();

  // Carga las conexiones conectadas al montar el diálogo.
  useEffect(() => {
    startLoad(async () => {
      const result = await listConnectedWhatsappAction(orgSlug);
      if (result.ok) {
        setConnections(result.connections);
        if (result.connections.length > 0) {
          setSelected(result.connections[0].id);
        }
      } else {
        setError(result.error);
        setConnections([]);
      }
    });
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit() {
    if (!selected) {
      setError("Selecciona un número de WhatsApp.");
      return;
    }
    setError(null);
    startImport(async () => {
      const result = await importFromWhatsappAction(orgSlug, selected);
      if (result.ok) setReport(result.report);
      else setError(result.error);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar contactos desde WhatsApp</DialogTitle>
          <DialogDescription>
            Importa como contactos a las personas que han conversado con un
            número de WhatsApp conectado. Los contactos sin teléfono y los
            duplicados se omiten.
          </DialogDescription>
        </DialogHeader>

        {report ? (
          <div className="border border-border p-3 text-sm">
            Importados: <strong>{report.imported}</strong> · Omitidos sin
            teléfono: <strong>{report.skippedNoPhone}</strong> · Omitidos por
            duplicado: <strong>{report.skippedDuplicate}</strong>
          </div>
        ) : (
          <Field>
            <FieldLabel htmlFor="wa-connection">Número de WhatsApp</FieldLabel>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                Buscando números conectados…
              </p>
            ) : connections && connections.length > 0 ? (
              <NativeSelect
                id="wa-connection"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.label}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay números de WhatsApp conectados. Conecta uno en la sección
                de WhatsApp para poder importar.
              </p>
            )}
          </Field>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={isImporting}>
              {report ? "Cerrar" : "Cancelar"}
            </Button>
          </DialogClose>
          {!report ? (
            <Button
              size="sm"
              onClick={submit}
              disabled={isImporting || isLoading || !selected}
            >
              {isImporting ? "Importando…" : "Importar"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportCsvDialog({
  orgSlug,
  onClose,
}: {
  orgSlug: string;
  onClose: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [state, setState] = useState<ImportCsvState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startImport] = useTransition();

  async function onFile(file: File | undefined) {
    setError(null);
    setState(null);
    if (!file) {
      setFileName(null);
      setCsvText(null);
      return;
    }
    setFileName(file.name);
    setCsvText(await file.text());
  }

  function submit() {
    if (!csvText) {
      setError("Selecciona un archivo CSV.");
      return;
    }
    setError(null);
    startImport(async () => {
      const result = await importContactsCsvAction(orgSlug, csvText);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setState(result);
    });
  }

  const report = state?.ok ? state.report : null;

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar contactos desde CSV</DialogTitle>
          <DialogDescription>
            El archivo debe incluir las columnas nombres y telefono (también
            apellidos, email, direccion, ciudad y empresa). Los teléfonos deben
            estar en formato internacional. Los duplicados por teléfono se
            omiten.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="text-sm"
          />
          {fileName ? (
            <p className="text-xs text-muted-foreground">
              Archivo: {fileName}
            </p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {report ? (
          <div className="flex flex-col gap-2 border border-border p-3 text-sm">
            <p>
              Importados: <strong>{report.imported}</strong> · Omitidos por
              duplicado: <strong>{report.skippedDuplicate}</strong> · Inválidos:{" "}
              <strong>{report.invalid.length}</strong>
            </p>
            {report.invalid.length > 0 ? (
              <ul className="max-h-40 overflow-y-auto text-xs text-muted-foreground">
                {report.invalid.map((row) => (
                  <li key={row.row}>
                    Fila {row.row}: {row.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              {report ? "Cerrar" : "Cancelar"}
            </Button>
          </DialogClose>
          {!report ? (
            <Button
              size="sm"
              onClick={submit}
              disabled={isPending || !csvText}
            >
              {isPending ? "Importando…" : "Importar"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContactFormDialog({
  orgSlug,
  target,
  availableTags,
  onClose,
}: {
  orgSlug: string;
  target: EditTarget;
  availableTags: TagDtoT[];
  onClose: () => void;
}) {
  const isEdit = target.mode === "edit";
  const [values, setValues] = useState<FormValues>(
    isEdit ? toForm(target.contact) : EMPTY_FORM,
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    isEdit ? target.contact.tags.map((t) => t.id) : [],
  );
  const [state, setState] = useState<ContactFormState>({});
  const [isPending, startSubmit] = useTransition();

  function update(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }

  function submit() {
    setState({});
    startSubmit(async () => {
      if (isEdit) {
        const result = await updateContactAction(
          orgSlug,
          target.contact.id,
          values,
        );
        if (!result.ok) {
          setState(result);
          return;
        }
        const tagResult = await setContactTagsAction(
          orgSlug,
          target.contact.id,
          selectedTagIds,
        );
        if (!tagResult.ok) {
          setState({ error: tagResult.error });
          return;
        }
        onClose();
        return;
      }

      const result = await createContactAction(orgSlug, values);
      if (!result.ok || !result.contactId) {
        setState(result);
        return;
      }
      if (selectedTagIds.length > 0) {
        const tagResult = await setContactTagsAction(
          orgSlug,
          result.contactId,
          selectedTagIds,
        );
        if (!tagResult.ok) {
          setState({ error: tagResult.error });
          return;
        }
      }
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar contacto" : "Nuevo contacto"}
          </DialogTitle>
          <DialogDescription>
            Registre los datos de contacto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            id="firstName"
            label="Nombres"
            value={values.firstName}
            error={state.fieldErrors?.firstName}
            onChange={(v) => update("firstName", v)}
          />
          <TextField
            id="lastName"
            label="Apellidos"
            value={values.lastName}
            error={state.fieldErrors?.lastName}
            onChange={(v) => update("lastName", v)}
          />
          <TextField
            id="phone"
            label="Teléfono"
            value={values.phone}
            placeholder="+573001234567"
            error={state.fieldErrors?.phone}
            onChange={(v) => update("phone", v)}
          />
          <TextField
            id="email"
            label="Email"
            value={values.email}
            error={state.fieldErrors?.email}
            onChange={(v) => update("email", v)}
            placeholder="email@dominio.com"
          />
          <TextField
            id="company"
            label="Empresa"
            value={values.company}
            error={state.fieldErrors?.company}
            onChange={(v) => update("company", v)}
            placeholder="Comercial Exito"
          />
          <TextField
            id="city"
            label="Ciudad y Departamento"
            value={values.city}
            error={state.fieldErrors?.city}
            onChange={(v) => update("city", v)}
            placeholder="Medellín Antioquia"
          />
          <div className="sm:col-span-2">
            <TextField
              id="address"
              label="Dirección completa"
              value={values.address}
              error={state.fieldErrors?.address}
              onChange={(v) => update("address", v)}
              placeholder="Dirección"
            />
          </div>
        </div>

        {availableTags.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Etiquetas</p>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => {
                const checked = selectedTagIds.includes(tag.id);
                return (
                  <label
                    key={tag.id}
                    className="flex cursor-pointer items-center gap-1.5 border border-border px-2 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTag(tag.id)}
                    />
                    {tag.name}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button size="sm" onClick={submit} disabled={isPending}>
            {isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TextField({
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
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldError>{error}</FieldError>
    </Field>
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

function ManageTagsDialog({
  orgSlug,
  tags,
  onClose,
}: {
  orgSlug: string;
  tags: TagDtoT[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startAction] = useTransition();

  function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("El nombre no puede estar vacío.");
      return;
    }
    setError(null);
    startAction(async () => {
      const result = await createTagAction(orgSlug, trimmed);
      if (result.ok) setName("");
      else setError(result.error ?? "No se pudo crear la etiqueta.");
    });
  }

  function remove(tagId: string) {
    setError(null);
    startAction(async () => {
      const result = await deleteTagAction(orgSlug, tagId);
      if (!result.ok) {
        setError(result.error ?? "No se pudo eliminar la etiqueta.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gestionar etiquetas</DialogTitle>
          <DialogDescription>
            Crea etiquetas para clasificar tus contactos. Al eliminar una
            etiqueta se quita de todos los contactos que la tengan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <Field className="flex-1">
            <FieldLabel htmlFor="new-tag">Nueva etiqueta</FieldLabel>
            <Input
              id="new-tag"
              value={name}
              maxLength={60}
              placeholder="Por ejemplo: Clientes"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Button size="sm" onClick={create} disabled={isPending}>
            Agregar
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-col gap-1">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay etiquetas.
            </p>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between border border-border px-2 py-1 text-sm"
              >
                <span>{tag.name}</span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={`Eliminar etiqueta ${tag.name}`}
                  disabled={isPending}
                  onClick={() => remove(tag.id)}
                >
                  <TrashIcon />
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
