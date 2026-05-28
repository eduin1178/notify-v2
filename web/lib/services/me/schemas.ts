import { z } from "zod";

export const UserDto = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  image: z.string().url().nullable(),
  role: z.string().nullable(),
});

export const OrganizationSummaryDto = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  role: z.enum(["owner", "admin", "member"]),
});

export const MeResponse = z.object({
  user: UserDto,
  organizations: z.array(OrganizationSummaryDto),
});

export type UserDtoT = z.infer<typeof UserDto>;
export type OrganizationSummaryDtoT = z.infer<typeof OrganizationSummaryDto>;
export type MeResponseT = z.infer<typeof MeResponse>;
