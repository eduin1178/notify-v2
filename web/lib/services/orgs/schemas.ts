import { z } from "zod";

export const OrgIdParam = z.object({
  orgId: z.string().min(1),
});

export const OrganizationDto = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().url().nullable(),
  createdAt: z.string().datetime(),
});

export const MemberDto = z.object({
  id: z.string(),
  userId: z.string(),
  role: z.enum(["owner", "admin", "member"]),
  name: z.string(),
  email: z.string().email(),
  image: z.string().url().nullable(),
  createdAt: z.string().datetime(),
});

export const MembersResponse = z.object({
  members: z.array(MemberDto),
});

export type OrgIdParamT = z.infer<typeof OrgIdParam>;
export type OrganizationDtoT = z.infer<typeof OrganizationDto>;
export type MemberDtoT = z.infer<typeof MemberDto>;
export type MembersResponseT = z.infer<typeof MembersResponse>;
