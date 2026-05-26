import { env } from "@/lib/env";
import { fromEmail, resend } from "@/lib/email/resend";
import { renderInvitationEmail } from "@/lib/email/templates/invitation";

type SendInvitationParams = {
  email: string;
  invitationId: string;
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  role: string;
};

export async function sendInvitationEmail(params: SendInvitationParams): Promise<void> {
  const inviteLink = `${env.BETTER_AUTH_URL}/invitations/${params.invitationId}`;

  const { subject, html, text } = renderInvitationEmail({
    organizationName: params.organizationName,
    inviterName: params.inviterName,
    inviterEmail: params.inviterEmail,
    role: params.role,
    inviteLink,
  });

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: params.email,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error("[invitation-email] fallo al enviar via Resend", {
        invitationId: params.invitationId,
        to: params.email,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("[invitation-email] excepción al enviar invitación", {
      invitationId: params.invitationId,
      to: params.email,
      error,
    });
  }
}
