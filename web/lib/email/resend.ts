import { Resend } from "resend";

import { env } from "@/lib/env";

export const resend = new Resend(env.RESEND_API_KEY);

export const fromEmail = env.RESEND_FROM_EMAIL;
