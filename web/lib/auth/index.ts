import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";

import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { sendInvitationEmail } from "@/lib/email/send-invitation";

const INVITATION_TTL_DAYS = 7;
const INVITATION_TTL_SECONDS = INVITATION_TTL_DAYS * 24 * 60 * 60;

export const auth = betterAuth({
  appName: "Notify",

  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),

  emailAndPassword: {
    enabled: false,
  },

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (userData) => {
          if (
            env.SUPER_ADMIN_EMAIL &&
            typeof userData.email === "string" &&
            userData.email.trim().toLowerCase() === env.SUPER_ADMIN_EMAIL
          ) {
            return {
              data: {
                ...userData,
                role: "admin",
              },
            };
          }
          return { data: userData };
        },
        after: async (createdUser) => {
          await promoteIfSuperAdmin(createdUser);
        },
      },
      update: {
        after: async (updatedUser) => {
          await promoteIfSuperAdmin(updatedUser);
        },
      },
    },
    session: {
      create: {
        before: async (sessionData) => {
          const target = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.id, sessionData.userId),
          });

          if (target?.banned === true) {
            const expires = target.banExpires;
            if (!expires || expires.getTime() > Date.now()) {
              return false;
            }
          }

          return { data: sessionData };
        },
      },
    },
  },

  plugins: [
    organization({
      schema: {
        invitation: {
          fields: {
            status: "status",
          },
        },
      },
      invitationExpiresIn: INVITATION_TTL_SECONDS,
      cancelPendingInvitationsOnReInvite: true,
      sendInvitationEmail: async (data) => {
        await sendInvitationEmail({
          email: data.email,
          invitationId: data.id,
          organizationName: data.organization.name,
          inviterName: data.inviter.user.name,
          inviterEmail: data.inviter.user.email,
          role: typeof data.role === "string" ? data.role : "member",
        });
      },
    }),
    admin(),
    nextCookies(),
  ],
});

async function promoteIfSuperAdmin(target: {
  id: string;
  email: string;
  emailVerified?: boolean | null;
  role?: string | null;
}) {
  if (!env.SUPER_ADMIN_EMAIL) return;
  if (target.role === "admin") return;
  if (target.email.trim().toLowerCase() !== env.SUPER_ADMIN_EMAIL) return;
  if (target.emailVerified === false) return;

  const { eq } = await import("drizzle-orm");
  await db
    .update(schema.user)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(schema.user.id, target.id));
}
