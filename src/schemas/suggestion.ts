import { z } from "zod";

export const SuggestionTypeSchema = z.enum([
  "task",
  "exploration",
  "idea",
  "reference",
  "clarify_needed",
]);

export const SuggestionStatusSchema = z.string().min(1);

export const SuggestedFieldsSchema = z
  .object({
    category: z.string().nullable().optional(),
    follow_up_needed: z.boolean().nullable().optional(),
    due_date: z.string().nullable().optional(),
    waiting_on: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
  })
  .catchall(z.unknown());

export const SuggestionSchema = z
  .object({
    type: SuggestionTypeSchema,
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    status: SuggestionStatusSchema,
    confidence: z.number().min(0).max(1),
    needs_clarification: z.boolean(),
    clarification_question: z.string().min(1).optional(),
    missing_context: z.array(z.string()).optional(),
    suggested_fields: SuggestedFieldsSchema.optional().default({}),
  })
  .catchall(z.unknown());

export const SuggestionResultSchema = z
  .object({
    suggestions: z.array(SuggestionSchema),
  })
  .catchall(z.unknown());

export type SuggestionType = z.infer<typeof SuggestionTypeSchema>;
export type SuggestionStatus = z.infer<typeof SuggestionStatusSchema>;
export type SuggestedFields = z.infer<typeof SuggestedFieldsSchema>;
export type Suggestion = z.infer<typeof SuggestionSchema>;
export type SuggestionResult = z.infer<typeof SuggestionResultSchema>;
