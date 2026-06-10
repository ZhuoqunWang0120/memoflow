import { z } from "zod";

export const MemoryEntrySchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  archived_at: z.string().datetime().nullable().optional(),
});

export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;
