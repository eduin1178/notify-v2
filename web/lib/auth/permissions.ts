export type OrgRole = "owner" | "admin" | "member";

export type Actor = {
  isSuperAdmin: boolean;
  orgRole: OrgRole | null;
};

export type Target =
  | { kind: "member"; role: OrgRole; isSelf?: boolean }
  | { kind: "org" }
  | { kind: "platform" };

export type Action =
  | "platform.view"
  | "platform.users.suspend"
  | "org.create"
  | "org.delete"
  | "org.transferOwnership"
  | "org.editSettings"
  | "org.members.view"
  | "org.members.invite"
  | "org.members.changeRole"
  | "org.members.remove"
  | "org.leave"
  | "org.content.view"
  | "org.whatsapp.connect";

export function can(actor: Actor, action: Action, target: Target = { kind: "org" }): boolean {
  if (actor.isSuperAdmin && target.kind !== "member") return true;

  const role = actor.orgRole;

  switch (action) {
    case "platform.view":
    case "platform.users.suspend":
      return actor.isSuperAdmin;

    case "org.create":
      return true;

    case "org.delete":
    case "org.transferOwnership":
      return role === "owner";

    case "org.editSettings":
      return role === "owner" || role === "admin";

    case "org.whatsapp.connect":
      // Conectar/desconectar/reconectar cuentas de WhatsApp: solo owner/admin.
      return role === "owner" || role === "admin";

    case "org.members.view":
    case "org.content.view":
      return role === "owner" || role === "admin" || role === "member";

    case "org.members.invite":
      return role === "owner" || role === "admin";

    case "org.members.changeRole":
    case "org.members.remove": {
      if (target.kind !== "member") return false;
      if (actor.isSuperAdmin) return true;

      if (role === "owner") {
        return target.role !== "owner" || (target.isSelf === false);
      }
      if (role === "admin") {
        return target.role === "member";
      }
      return false;
    }

    case "org.leave":
      return role === "admin" || role === "member";
  }
}

export function canOwnerLeave(otherOwnersCount: number): boolean {
  return otherOwnersCount >= 1;
}
