import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  description: z.string().max(1000).optional(),
  app_store_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  google_play_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

export const updateProjectSchema = createProjectSchema.partial();
