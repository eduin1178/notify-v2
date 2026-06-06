import * as React from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * Contenedor de campo de formulario. Aporta el espaciado consistente entre
 * etiqueta, control y mensaje de error. No depende de react-hook-form: envuelve
 * cualquier control (Input, NativeSelect, etc.) pasado como `children`, de modo
 * que sirve tanto para formularios con Server Actions como para estado cliente.
 */
function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field"
      className={cn("grid gap-2.5", className)}
      {...props}
    />
  );
}

/** Etiqueta del campo. Reexporta `Label` para mantener un único import. */
function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label className={className} {...props} />;
}

/** Texto de ayuda secundario debajo del control. */
function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

/** Mensaje de error del campo. No renderiza nada si no hay contenido. */
function FieldError({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  if (!children) return null;

  return (
    <p
      data-slot="field-error"
      role="alert"
      className={cn("text-xs text-destructive", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export { Field, FieldLabel, FieldDescription, FieldError };
