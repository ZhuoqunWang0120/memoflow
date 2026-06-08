import { z } from "zod";

export const ItemTypeSchema = z.enum([
  "task",
  "exploration",
  "idea",
  "reference",
]);

export const ItemFieldsSchema = z
  .object({
    follow_up_needed: z.boolean().nullable().optional(),
    due_date: z.string().nullable().optional(),
    waiting_on: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    category: z.string().nullable().optional(),
  })
  .catchall(z.unknown());

export const ItemSourceSchema = z
  .object({
    kind: z.enum(["manual", "suggestion"]),
    raw_text: z.string().optional(),
    suggestion: z.unknown().optional(),
  })
  .catchall(z.unknown());

export const ItemSchema = z
  .object({
    id: z.string().min(1),
    type: ItemTypeSchema,
    title: z.string().min(1),
    description: z.string().optional(),
    status: z.string().min(1),
    fields: ItemFieldsSchema.optional().default({}),
    source: ItemSourceSchema.optional(),
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
    archived_at: z.string().nullable().optional().default(null),
  })
  .catchall(z.unknown());

export const ItemResultSchema = z.object({
  items: z.array(ItemSchema),
});

export type ItemType = z.infer<typeof ItemTypeSchema>;
export type ItemFields = z.infer<typeof ItemFieldsSchema>;
export type ItemSource = z.infer<typeof ItemSourceSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type ItemResult = z.infer<typeof ItemResultSchema>;
