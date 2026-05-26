type InvitationEmailProps = {
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  role: string;
  inviteLink: string;
};

const roleLabel: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
};

export function renderInvitationEmail({
  organizationName,
  inviterName,
  inviterEmail,
  role,
  inviteLink,
}: InvitationEmailProps): { subject: string; html: string; text: string } {
  const subject = `Te invitaron a unirte a ${organizationName} en Notify`;
  const label = roleLabel[role] ?? "Miembro";

  const html = `
    <!doctype html>
    <html lang="es">
      <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
        <div style="max-width: 520px; margin: 0 auto; padding: 32px 16px;">
          <h1 style="font-size: 20px; margin: 0 0 16px;">Tienes una invitación</h1>
          <p>Hola,</p>
          <p>
            <strong>${escapeHtml(inviterName)}</strong>
            (${escapeHtml(inviterEmail)}) te invitó a unirte a
            <strong>${escapeHtml(organizationName)}</strong> en Notify como
            <strong>${escapeHtml(label)}</strong>.
          </p>
          <p style="margin: 24px 0;">
            <a
              href="${inviteLink}"
              style="background: #111; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;"
            >
              Aceptar invitación
            </a>
          </p>
          <p style="font-size: 13px; color: #555;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
            <span style="word-break: break-all;">${inviteLink}</span>
          </p>
          <p style="font-size: 12px; color: #777; margin-top: 32px;">
            Si no esperabas esta invitación, puedes ignorar este mensaje.
          </p>
        </div>
      </body>
    </html>
  `;

  const text = [
    `Tienes una invitación.`,
    ``,
    `${inviterName} (${inviterEmail}) te invitó a unirte a ${organizationName} en Notify como ${label}.`,
    ``,
    `Acepta la invitación abriendo este enlace:`,
    inviteLink,
    ``,
    `Si no esperabas esta invitación, puedes ignorar este mensaje.`,
  ].join("\n");

  return { subject, html, text };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
