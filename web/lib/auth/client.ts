"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [organizationClient(), adminClient()],
});

export const { signIn, signOut, signUp, useSession, organization, admin } =
  authClient;
