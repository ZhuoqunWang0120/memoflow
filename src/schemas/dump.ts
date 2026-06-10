import { z } from "zod";

export const DumpStatusSchema = z.enum([
  "pending",
  "reviewed",
  "ignored",
]);

export const DumpSchema = z
  .object({
    id: z.string().min(1),
    raw_text: z.string().min(1),
    status: DumpStatusSchema,
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
    reviewed_at: z.string().nullable().optional().default(null),
    ignored_at: z.string().nullable().optional().default(null),
    source: z.string().nullable().optional().default(null),
  })
  .catchall(z.unknown());

export const DumpResultSchema = z.object({
  dumps: z.array(DumpSchema),
});

export type DumpStatus = z.infer<typeof DumpStatusSchema>;
export type Dump = z.infer<typeof DumpSchema>;
export type DumpResult = z.infer<typeof DumpResultSchema>;
