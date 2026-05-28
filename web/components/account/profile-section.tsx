import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const DATE_FORMATTER = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

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

export type ProfileSectionProps = {
  user: {
    name: string;
    email: string;
    image: string | null | undefined;
    createdAt: Date;
  };
};

export function ProfileSection({ user }: ProfileSectionProps) {
  return (
    <section className="rounded-lg border bg-card p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Tus datos</h2>
        <p className="text-sm text-muted-foreground">
          Información asociada a tu cuenta de Notify.
        </p>
      </header>
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 rounded-lg">
          {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
          <AvatarFallback className="rounded-lg text-lg">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        <dl className="grid flex-1 gap-1 text-sm">
          <div>
            <dt className="sr-only">Nombre</dt>
            <dd className="font-medium">{user.name}</dd>
          </div>
          <div>
            <dt className="sr-only">Correo</dt>
            <dd className="text-muted-foreground">{user.email}</dd>
          </div>
          <div>
            <dt className="sr-only">Fecha de registro</dt>
            <dd className="text-xs text-muted-foreground">
              Te uniste el {DATE_FORMATTER.format(user.createdAt)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
