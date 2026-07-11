import { z } from "zod";
import { ItemFieldsSchema } from "./item.js";
import { SuggestionTypeSchema } from "./suggestion.js";

export const CorrectionSnapshotSchema = z.object({
  type: SuggestionTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.string().min(1),
  fields: ItemFieldsSchema.optional().default({}),
});

export const LearningStatusSchema = z.enum(["unreviewed"]);

export const CorrectionEventSchema = z.object({
  id: z.string().min(1),
  created_at: z.string().datetime(),
  source: z.string().min(1),
  proposal_id: z.string().nullable().optional(),
  dump_id: z.string().nullable().optional(),
  saved_item_id: z.string().nullable().optional(),
  before: CorrectionSnapshotSchema,
  after: CorrectionSnapshotSchema,
  changed_fields: z.array(z.string()),
  learning_status: LearningStatusSchema,
});

export type CorrectionSnapshot = z.infer<typeof CorrectionSnapshotSchema>;
export type LearningStatus = z.infer<typeof LearningStatusSchema>;
export type CorrectionEvent = z.infer<typeof CorrectionEventSchema>;
