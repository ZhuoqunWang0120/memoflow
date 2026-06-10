import { z } from "zod";
import { ItemFieldsSchema, ItemTypeSchema } from "../schemas/item.js";

export const UpdateItemRequestSchema = z.object({
  type: ItemTypeSchema.optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.string().trim().min(1).optional(),
  due_date: z.string().trim().nullable().optional(),
  follow_up_date: z.string().trim().nullable().optional(),
  fields: ItemFieldsSchema.optional(),
}).strict();

export function itemUpdatePatchFromRequest(body: z.infer<typeof UpdateItemRequestSchema>) {
  const fields = {
    ...(body.fields ?? {}),
  };

  if ("due_date" in body) fields.due_date = body.due_date;
  if ("follow_up_date" in body) fields.follow_up_date = body.follow_up_date;

  return {
    type: body.type,
    title: body.title,
    description: body.description,
    status: body.status,
    fields: Object.keys(fields).length > 0 ? fields : undefined,
  };
}
