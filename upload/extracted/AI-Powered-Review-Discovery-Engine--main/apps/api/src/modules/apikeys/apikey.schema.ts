import { z } from 'zod';

export const generateKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  scopes: z
    .array(z.enum(['read', 'write', 'admin']))
    .min(1, 'At least one scope is required')
    .default(['read']),
});
