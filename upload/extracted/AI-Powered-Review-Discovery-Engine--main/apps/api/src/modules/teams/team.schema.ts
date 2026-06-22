import { z } from 'zod';

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .email('Invalid email')
    .transform((v) => v.toLowerCase()),
  role: z.enum(['admin', 'analyst', 'viewer'], {
    errorMap: () => ({ message: 'Role must be admin, analyst, or viewer' }),
  }),
});

export const updateRoleSchema = z.object({
  role: z.enum(['admin', 'analyst', 'viewer']),
});
