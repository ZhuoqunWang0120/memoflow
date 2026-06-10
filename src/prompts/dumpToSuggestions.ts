import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ContextBundle } from "../parsers/types.js";

export function buildDumpToSuggestionsPrompt(input: {
  rawText: string;
  context?: ContextBundle;
}): string {
  const currentDate = getLocalDateString();
  const userMemoryText = buildUserMemoryText(input.context?.snippets);
  const contextText = buildAdditionalContextText(input.context);

  return `Transform the raw memo dump into structured suggestions.

Use these project rules, derived from src/examples/suggestion_definitions.md:
${buildCompactDefinitions()}

Use these representative few-shot examples, selected from src/examples/dump2suggestions_few_shot_ex.md and current product rules:
${buildFewShotExamples()}

Instructions:
- Return JSON only.
- Split one memo into multiple suggestions when needed.
- Classify based on observable wording, not hidden commitment.
- Do not infer commitment_level and do not include commitment_level.
- Avoid over-inference and hallucinated context.
- Preserve the user's intent as much as possible.
- Mark ambiguity explicitly with type "clarify_needed" and needs_clarification true.
- For clarify_needed, include clarification_question and missing_context.
- Use confidence from 0 to 1.
- Use default statuses unless the memo clearly implies a different status:
  task -> ready
  exploration -> open
  idea -> saved
  reference -> saved
  clarify_needed -> needs_clarification
- suggested_fields may include follow_up_needed, due_date, waiting_on, url, tags, and category.
- Do not force optional fields. Use null when a field is unknown but included.
- Current local date is ${currentDate}. Use this date for low-effort due-date inference when the wording has an observable time expression.
- Date inference should be LLM-first with guardrails: identify the exact date phrase, normalize its meaning, then set due_date. Do not substring-match shorter phrases inside longer phrases.
- Resolve common relative dates and weekdays:
  today / 今天 -> current date
  tomorrow / tmr / 明天 -> current date + 1 day
  day after tomorrow / 后天 -> current date + 2 days
  three days from today / 大后天 -> current date + 3 days. Important: 大后天 is not 后天.
  tomorrow or the day after tomorrow / 明后天 -> latest acceptable date, usually current date + 2 days
  today or tomorrow / today or tmr / 今天或明天 -> latest acceptable date, usually tomorrow
  今天或大后天 -> latest acceptable date, usually current date + 3 days
  Monday-Friday / this Friday / 周一-周日 / 星期一-星期日 -> next upcoming named weekday
  next Friday / 下周五 / 下星期五 -> named weekday in the following week
- Be flexible with obvious short memo phrasing. For example, "周五买菜" means a task to buy groceries due on the upcoming Friday.
- Ambiguous short ranges such as "这两天" may be due_date null, current date + 2 days, or current date + 3 days depending on interpretation. Preserve the original timing phrase in the description.
- Do not invent calendar dates when there is no observable time expression. If the memo has no due date signal, set due_date to null.
- If the memo gives an acceptable date range such as "today or tomorrow" or "today or tmr", set due_date to the latest acceptable date.
- If the memo gives only imprecise timing such as "this week" or "soon", set due_date to null and preserve the timing text in the description.
- If due_date is set, format it as YYYY-MM-DD.
- Set waiting_on only when the user is actually blocked by or waiting for another person. Do not set waiting_on just because a task involves contacting someone.
- User memory is optional context only. Use it to resolve names, shorthand, or personal context when it directly helps interpret the raw memo.
- If user memory conflicts with the raw memo, the raw memo wins.
- If user memory is insufficient to resolve ambiguity, preserve uncertainty and use clarify_needed.

Expected JSON shape:
{
  "suggestions": [
    {
      "type": "task | exploration | idea | reference | clarify_needed",
      "title": "string",
      "description": "optional string",
      "status": "string",
      "confidence": 0.0,
      "needs_clarification": false,
      "clarification_question": "optional string for clarify_needed",
      "missing_context": ["optional strings for clarify_needed"],
      "suggested_fields": {
        "follow_up_needed": null,
        "due_date": null,
        "waiting_on": null,
        "url": null,
        "tags": null,
        "category": null
      }
    }
  ]
}

${userMemoryText}
${contextText}

Raw memo:
${input.rawText}`;
}

function buildUserMemoryText(snippets: string[] | undefined): string {
  const compact = (snippets ?? [])
    .map((snippet) => snippet.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (compact.length === 0) return "";

  return `User memory:
${compact.map((snippet) => `- ${snippet}`).join("\n")}
`;
}

function buildAdditionalContextText(context: ContextBundle | undefined): string {
  if (!context) return "";

  const rest = Object.fromEntries(
    Object.entries(context).filter(([key, value]) => key !== "snippets" && value !== undefined),
  );

  if (Object.keys(rest).length === 0) return "";
  return `Additional optional context:
${JSON.stringify(rest, null, 2)}
`;
}

function buildCompactDefinitions(): string {
  const source = readExampleFile("suggestion_definitions.md");
  if (!source) return FALLBACK_DEFINITIONS;

  const corePrinciple = extractSection(source, "## Core Principle", "## Core Object Types");
  const objectTypes = extractSection(source, "## Core Object Types", "## Recommended Status Values");
  const barePhrase = extractSection(source, "### Bare Phrase Handling", "## Field Meanings");

  return [corePrinciple, objectTypes, barePhrase]
    .filter(Boolean)
    .join("\n")
    .slice(0, 7000);
}

function buildFewShotExamples(): string {
  const source = readExampleFile("dump2suggestions_few_shot_ex.md");
  const selected = source
    ? [
        extractExample(source, 1),
        extractExample(source, 7),
        extractExample(source, 11),
        extractExample(source, 18),
        extractExample(source, 19),
        extractExample(source, 25),
        extractExample(source, 27),
        extractExample(source, 32),
      ].filter(Boolean)
    : [];

  return [
    ...selected,
    REQUIRED_FEW_SHOTS,
  ]
    .join("\n\n")
    .slice(0, 10000);
}

function readExampleFile(fileName: string): string | null {
  const path = join(process.cwd(), "src", "examples", fileName);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function extractSection(source: string, startHeading: string, endHeading: string): string {
  const start = source.indexOf(startHeading);
  if (start === -1) return "";
  const end = source.indexOf(endHeading, start + startHeading.length);
  return source.slice(start, end === -1 ? undefined : end).trim();
}

function extractExample(source: string, exampleNumber: number): string {
  const padded = String(exampleNumber).padStart(2, "0");
  const startHeading = `### Example ${padded}`;
  const start = source.indexOf(startHeading);
  if (start === -1) return "";

  const next = source.indexOf("\n---", start + startHeading.length);
  return source.slice(start, next === -1 ? undefined : next).trim();
}

function getLocalDateString(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

const FALLBACK_DEFINITIONS = `Core rules:
- Classify based on observable wording, not hidden commitment.
- task: concrete action, deliverable, person to contact, deadline, or next step.
- exploration: active question, decision, research direction, learning goal, or sensemaking thread.
- idea: possible project, feature, content idea, direction, or bare topic without clear action/question.
- reference: information, link, reminder, or reflection to save, with no direct action implied.
- clarify_needed: insufficient information to safely classify without inventing context.
- Bare project/product/content phrase -> idea.
- Bare link -> reference.
- Bare reflection/principle -> reference.
- Bare unclear shorthand -> clarify_needed.
- Bare known action phrase -> task.`;

const REQUIRED_FEW_SHOTS = `### Required Current-Rule Examples

Input:
\`\`\`text
portfolio website
\`\`\`
Output:
\`\`\`json
{"suggestions":[{"type":"idea","title":"Create a portfolio website","description":"Possible project or career asset: build a portfolio website.","status":"saved","confidence":0.82,"needs_clarification":false,"suggested_fields":{"follow_up_needed":false,"due_date":null,"waiting_on":null,"category":"career/project"}}]}
\`\`\`

Input:
\`\`\`text
should I build this as webapp or iOS first?
\`\`\`
Output:
\`\`\`json
{"suggestions":[{"type":"exploration","title":"Decide whether to build the app as webapp or iOS first","description":"Compare whether the first version should be a webapp or iOS app.","status":"open","confidence":0.94,"needs_clarification":false,"suggested_fields":{"follow_up_needed":true,"due_date":null,"waiting_on":null}}]}
\`\`\`

Input:
\`\`\`text
email Duke about final eval. also maybe memo app should support waiting status
\`\`\`
Output:
\`\`\`json
{"suggestions":[{"type":"task","title":"Email Duke about final evaluation","description":"Contact Duke about the final evaluation.","status":"ready","confidence":0.92,"needs_clarification":false,"suggested_fields":{"follow_up_needed":true,"due_date":null,"waiting_on":null}},{"type":"idea","title":"Add waiting status to MemoFlow","description":"Possible product idea: MemoFlow could support a waiting status.","status":"saved","confidence":0.86,"needs_clarification":false,"suggested_fields":{"follow_up_needed":false,"due_date":null,"waiting_on":null,"category":"product"}}]}
\`\`\`

Input:
\`\`\`text
Yellow banana problem
\`\`\`
Output:
\`\`\`json
{"suggestions":[{"type":"clarify_needed","title":"Clarify the Yellow banana problem","description":"The memo appears to use private shorthand without enough context to classify safely.","status":"needs_clarification","confidence":0.55,"needs_clarification":true,"clarification_question":"What does Yellow banana problem refer to, and should it be saved, explored, or turned into an action?","missing_context":["Meaning of Yellow banana problem","Whether this is a task, idea, exploration, or reference"],"suggested_fields":{"follow_up_needed":false,"due_date":null,"waiting_on":null}}]}
\`\`\``;
