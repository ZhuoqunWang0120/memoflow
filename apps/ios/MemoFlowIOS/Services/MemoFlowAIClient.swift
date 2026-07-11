import Foundation

struct AIContextBundle {
  var memorySnippets: [String]
  var recentActiveItems: [ItemContextSummary]
  var keywordMatchedItems: [ItemContextSummary]
}

struct ItemContextSummary: Identifiable {
  let id: String
  let title: String
  let type: String
  let status: String
  let description: String?
}

enum MemoFlowAIError: LocalizedError {
  case missingAPIKey
  case invalidEndpoint
  case httpFailure(Int, String)
  case missingOutputText
  case invalidJSON(String)

  var errorDescription: String? {
    switch self {
    case .missingAPIKey:
      return "MEMOFLOW_OPENAI_API_KEY is required for native development AI."
    case .invalidEndpoint:
      return "The configured AI endpoint is invalid."
    case let .httpFailure(code, message):
      return "AI request failed with status \(code): \(message)"
    case .missingOutputText:
      return "AI response did not include output text."
    case let .invalidJSON(message):
      return "AI response JSON was invalid: \(message)"
    }
  }
}

final class MemoFlowAIClient {
  private let session: URLSession

  init(session: URLSession = .shared) {
    self.session = session
  }

  func generateSuggestions(
    rawText: String,
    useMemory: Bool,
    useContext: Bool,
    context: AIContextBundle
  ) async throws -> [SuggestionDraft] {
    let apiKey = readConfigValue(named: "MEMOFLOW_OPENAI_API_KEY")
    guard let apiKey, !apiKey.isEmpty else {
      throw MemoFlowAIError.missingAPIKey
    }

    let endpointString = readConfigValue(named: "MEMOFLOW_OPENAI_BASE_URL")
      ?? "https://api.openai.com/v1/responses"
    guard let url = URL(string: endpointString) else {
      throw MemoFlowAIError.invalidEndpoint
    }

    let model = readConfigValue(named: "MEMOFLOW_OPENAI_MODEL") ?? "gpt-4o-mini"
    let prompt = MemoFlowPromptBuilder.buildPrompt(
      rawText: rawText,
      useMemory: useMemory,
      useContext: useContext,
      context: context
    )

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: buildRequestBody(model: model, prompt: prompt))

    let (data, response) = try await session.data(for: request)
    guard let http = response as? HTTPURLResponse else {
      throw MemoFlowAIError.httpFailure(-1, "Non-HTTP response")
    }

    guard (200 ... 299).contains(http.statusCode) else {
      throw MemoFlowAIError.httpFailure(http.statusCode, parseErrorMessage(data: data))
    }

    let outputText = try extractOutputText(from: data)

    let decoder = JSONDecoder()
    let envelope: SuggestionResultEnvelope
    do {
      envelope = try decoder.decode(SuggestionResultEnvelope.self, from: Data(outputText.utf8))
    } catch {
      throw MemoFlowAIError.invalidJSON(error.localizedDescription)
    }

    return normalize(envelope.suggestions)
  }

  private func buildRequestBody(model: String, prompt: String) -> [String: Any] {
    [
      "model": model,
      "input": [
        [
          "role": "user",
          "content": [
            [
              "type": "input_text",
              "text": prompt,
            ],
          ],
        ],
      ],
      "text": [
        "format": [
          "type": "json_schema",
          "name": "suggestion_result",
          "strict": false,
          "schema": [
            "type": "object",
            "additionalProperties": false,
            "properties": [
              "suggestions": [
                "type": "array",
                "items": [
                  "type": "object",
                  "additionalProperties": true,
                  "properties": [
                    "type": [
                      "type": "string",
                      "enum": ["task", "exploration", "idea", "reference"],
                    ],
                    "title": ["type": "string"],
                    "description": ["type": "string"],
                    "status": ["type": "string"],
                    "confidence": ["type": "number", "minimum": 0, "maximum": 1],
                    "needs_clarification": ["type": "boolean"],
                    "clarification_question": ["type": "string"],
                    "missing_context": ["type": "array", "items": ["type": "string"]],
                    "suggested_fields": [
                      "type": "object",
                      "additionalProperties": true,
                      "properties": [
                        "category": ["type": ["string", "null"]],
                        "follow_up_needed": ["type": ["boolean", "null"]],
                        "due_date": ["type": ["string", "null"]],
                        "waiting_on": ["type": ["string", "null"]],
                        "url": ["type": ["string", "null"]],
                        "tags": ["type": ["array", "null"], "items": ["type": "string"]],
                      ],
                    ],
                    "related_existing_items": [
                      "type": "array",
                      "items": [
                        "type": "object",
                        "additionalProperties": false,
                        "properties": [
                          "item_id": ["type": "string"],
                          "relationship": [
                            "type": "string",
                            "enum": ["possible_duplicate", "follow_up", "same_topic"],
                          ],
                          "reason": ["type": "string"],
                          "confidence": ["type": "number", "minimum": 0, "maximum": 1],
                        ],
                        "required": ["item_id", "relationship", "reason", "confidence"],
                      ],
                    ],
                  ],
                  "required": ["type", "title", "status", "confidence", "needs_clarification"],
                ],
              ],
            ],
            "required": ["suggestions"],
          ],
        ],
      ],
    ]
  }

  private func parseErrorMessage(data: Data) -> String {
    if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
       let error = object["error"] as? [String: Any],
       let message = error["message"] as? String {
      return message
    }

    return String(data: data, encoding: .utf8) ?? "Unknown error"
  }

  private func extractOutputText(from data: Data) throws -> String {
    let object = try JSONSerialization.jsonObject(with: data)

    if let dict = object as? [String: Any], let text = dict["output_text"] as? String {
      return text
    }

    if let dict = object as? [String: Any],
       let output = dict["output"] as? [[String: Any]] {
      for item in output {
        guard let content = item["content"] as? [[String: Any]] else { continue }
        for segment in content {
          if let text = segment["text"] as? String {
            return text
          }
        }
      }
    }

    throw MemoFlowAIError.missingOutputText
  }

  private func normalize(_ suggestions: [SuggestionDraft]) -> [SuggestionDraft] {
    suggestions.map { suggestion in
      let trimmedTitle = suggestion.title.trimmingCharacters(in: .whitespacesAndNewlines)
      let trimmedDescription = suggestion.description?.trimmingCharacters(in: .whitespacesAndNewlines)
      let normalizedNeedsClarification = suggestion.needsClarification || suggestion.status == "needs_clarification"
      let normalizedType = MemoFlowDomain.validTypes.contains(suggestion.type) ? suggestion.type : "reference"
      let normalizedStatus = MemoFlowDomain.normalizeApprovedStatus(
        currentStatus: suggestion.status,
        needsClarification: normalizedNeedsClarification,
        type: normalizedType
      )

      return SuggestionDraft(
        id: suggestion.id,
        proposalID: suggestion.proposalID ?? "prop_\(UUID().uuidString.lowercased())",
        type: normalizedType,
        title: trimmedTitle.isEmpty ? "Untitled suggestion" : trimmedTitle,
        description: (trimmedDescription?.isEmpty ?? true) ? nil : trimmedDescription,
        status: normalizedStatus,
        confidence: min(1, max(0, suggestion.confidence)),
        needsClarification: normalizedNeedsClarification,
        clarificationQuestion: suggestion.clarificationQuestion,
        missingContext: suggestion.missingContext,
        suggestedFields: suggestion.suggestedFields,
        relatedExistingItems: suggestion.relatedExistingItems.filter { !$0.itemID.isEmpty }
      )
    }
  }
}

private func readConfigValue(named name: String) -> String? {
  if let environment = ProcessInfo.processInfo.environment[name], !environment.isEmpty {
    return environment
  }

  if let plistValue = Bundle.main.object(forInfoDictionaryKey: name) as? String, !plistValue.isEmpty {
    return plistValue
  }

  return nil
}
