import Foundation

enum MemoFlowPromptBuilder {
  static func buildPrompt(
    rawText: String,
    useMemory: Bool,
    useContext: Bool,
    context: AIContextBundle
  ) -> String {
    var sections: [String] = []

    sections.append("""
You are MemoFlow's suggestion parser.

Return JSON only.

Rules:
- Valid suggestion types are only: task, exploration, idea, reference.
- Do not use clarify_needed as a type.
- If the memo is ambiguous, keep the closest valid type and set needs_clarification=true with status=needs_clarification.
- Do not invent missing facts.
- Description is optional; omit it when it adds little value.
- related_existing_items may reference only IDs explicitly included in context below.
""")

    if useMemory && !useContext && !context.memorySnippets.isEmpty {
      let memoryBlock = context.memorySnippets.enumerated().map { index, text in
        "\(index + 1). \(text)"
      }.joined(separator: "\n")

      sections.append("""
Active memory snippets:
\(memoryBlock)
""")
    }

    if useContext {
      let keywordBlock = context.keywordMatchedItems.map { item in
        "- \(item.id) | \(item.type) | \(item.status) | \(item.title)\(item.description.map { " | \($0)" } ?? "")"
      }.joined(separator: "\n")

      let recentBlock = context.recentActiveItems.map { item in
        "- \(item.id) | \(item.type) | \(item.status) | \(item.title)\(item.description.map { " | \($0)" } ?? "")"
      }.joined(separator: "\n")

      sections.append("""
Context items: keyword matched first, then recent active items.

Keyword matched items:
\(keywordBlock.isEmpty ? "- none" : keywordBlock)

Recent active items:
\(recentBlock.isEmpty ? "- none" : recentBlock)
""")
    }

    sections.append("""
Return exactly this top-level shape:
{
  "suggestions": [
    {
      "type": "task|exploration|idea|reference",
      "title": "string",
      "description": "optional string",
      "status": "string",
      "confidence": 0.0,
      "needs_clarification": false,
      "clarification_question": "optional string",
      "missing_context": ["optional strings"],
      "suggested_fields": {
        "category": "optional string",
        "follow_up_needed": true,
        "due_date": "optional string",
        "waiting_on": "optional string",
        "url": "optional string",
        "tags": ["optional", "strings"]
      },
      "related_existing_items": [
        {
          "item_id": "context item id",
          "relationship": "possible_duplicate|follow_up|same_topic",
          "reason": "string",
          "confidence": 0.0
        }
      ]
    }
  ]
}

Raw memo:
\(rawText)
""")

    return sections.joined(separator: "\n\n")
  }
}
