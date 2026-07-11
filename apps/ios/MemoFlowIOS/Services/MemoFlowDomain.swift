import Foundation
import SwiftData

enum MemoFlowDomain {
  static let validTypes = ["task", "exploration", "idea", "reference"]

  static func defaultStatus(for type: String) -> String {
    switch type {
    case "task":
      return "ready"
    case "exploration":
      return "open"
    case "idea", "reference":
      return "saved"
    default:
      return "saved"
    }
  }

  static func normalizeApprovedStatus(currentStatus: String?, needsClarification: Bool, type: String) -> String {
    let trimmed = currentStatus?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if trimmed.isEmpty {
      return needsClarification ? "needs_clarification" : defaultStatus(for: type)
    }
    return trimmed
  }

  static func archive(item: ItemRecord) {
    let now = Date()
    item.status = "archived"
    item.archivedAt = now
    item.updatedAt = now
  }

  static func unarchive(item: ItemRecord) {
    item.archivedAt = nil
    if item.status == "archived" {
      item.status = defaultStatus(for: item.type)
    }
    item.updatedAt = Date()
  }

  static func markReviewed(dump: DumpRecord) {
    let now = Date()
    dump.status = "reviewed"
    dump.reviewedAt = now
    dump.updatedAt = now
  }

  static func ignore(dump: DumpRecord) {
    let now = Date()
    dump.status = "ignored"
    dump.ignoredAt = now
    dump.updatedAt = now
  }

  static func activeItemSummaries(from items: [ItemRecord]) -> [ItemContextSummary] {
    items
      .filter { $0.archivedAt == nil && $0.status != "done" && $0.status != "archived" }
      .sorted { $0.updatedAt > $1.updatedAt }
      .map {
        ItemContextSummary(
          id: $0.id,
          title: $0.title,
          type: $0.type,
          status: $0.status,
          description: $0.itemDescription
        )
      }
  }

  static func buildContext(items: [ItemRecord], memories: [MemoryRecord], rawText: String) -> AIContextBundle {
    let activeMemories = memories
      .filter { $0.archivedAt == nil }
      .sorted { $0.updatedAt > $1.updatedAt }
      .prefix(20)
      .map(\.text)

    let activeItems = activeItemSummaries(from: items)
    let keywordMatched = keywordMatchedItems(rawText: rawText, items: activeItems).prefix(5)
    let keywordIDs = Set(keywordMatched.map(\.id))
    let recent = activeItems.filter { !keywordIDs.contains($0.id) }.prefix(20)

    return AIContextBundle(
      memorySnippets: Array(activeMemories),
      recentActiveItems: Array(recent),
      keywordMatchedItems: Array(keywordMatched)
    )
  }

  static func keywordMatchedItems(rawText: String, items: [ItemContextSummary]) -> [ItemContextSummary] {
    let tokens = tokenize(rawText)
    guard !tokens.isEmpty else { return [] }

    return items
      .enumerated()
      .map { offset, item in
        (offset, item, overlapScore(tokens, tokenize([item.title, item.description ?? ""].joined(separator: " "))))
      }
      .filter { $0.2 > 0 }
      .sorted {
        if $0.2 != $1.2 { return $0.2 > $1.2 }
        return $0.0 < $1.0
      }
      .map(\.1)
  }

  static func saveApprovedSuggestion(
    suggestion: SuggestionDraft,
    rawText: String,
    dumpID: String?,
    modelContext: ModelContext
  ) throws -> ItemRecord {
    let suggestionJSON = try encodeJSONString(suggestion)
    let item = ItemRecord(
      type: suggestion.type,
      title: suggestion.title.trimmingCharacters(in: .whitespacesAndNewlines),
      itemDescription: suggestion.description.trimmedNilIfBlank,
      status: normalizeApprovedStatus(
        currentStatus: suggestion.status,
        needsClarification: suggestion.needsClarification,
        type: suggestion.type
      ),
      category: suggestion.suggestedFields.category.trimmedNilIfBlank,
      followUpNeeded: suggestion.suggestedFields.followUpNeeded,
      dueDateText: suggestion.suggestedFields.dueDate.trimmedNilIfBlank,
      followUpDateText: suggestion.suggestedFields.followUpDate.trimmedNilIfBlank,
      waitingOn: suggestion.suggestedFields.waitingOn.trimmedNilIfBlank,
      url: suggestion.suggestedFields.url.trimmedNilIfBlank,
      tagsCSV: suggestion.suggestedFields.tags?.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }.joined(separator: ","),
      sourceKind: "suggestion",
      sourceRawText: rawText,
      sourceSuggestionJSON: suggestionJSON
    )

    modelContext.insert(item)
    try maybeLogCorrectionEvent(
      suggestion: suggestion,
      item: item,
      dumpID: dumpID,
      modelContext: modelContext
    )
    return item
  }

  static func maybeLogCorrectionEvent(
    suggestion: SuggestionDraft,
    item: ItemRecord,
    dumpID: String?,
    modelContext: ModelContext
  ) throws {
    let before = CorrectionSnapshot.from(suggestion: suggestion)
    let after = CorrectionSnapshot.from(item: item)
    let changedFields = before.changedFields(comparedTo: after)
    guard !changedFields.isEmpty else { return }

    let event = CorrectionEventRecord(
      source: "native_review",
      proposalID: suggestion.proposalID,
      dumpID: dumpID,
      savedItemID: item.id,
      beforeJSON: try encodeJSONString(before),
      afterJSON: try encodeJSONString(after),
      changedFieldsCSV: changedFields.joined(separator: ",")
    )
    modelContext.insert(event)
  }

  static func encodeJSONString<T: Encodable>(_ value: T) throws -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(value)
    return String(decoding: data, as: UTF8.self)
  }

  private static func overlapScore(_ left: Set<String>, _ right: Set<String>) -> Int {
    left.reduce(into: 0) { partialResult, token in
      if right.contains(token) { partialResult += 1 }
    }
  }

  private static func tokenize(_ text: String) -> Set<String> {
    let stopwords = Set([
      "a", "an", "and", "are", "as", "at", "about", "be", "by", "for", "from",
      "i", "in", "is", "it", "me", "my", "of", "on", "or", "the", "this", "to", "with",
    ])

    let parts = text
      .lowercased()
      .components(separatedBy: CharacterSet.alphanumerics.inverted)
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { $0.count > 2 && !stopwords.contains($0) }

    return Set(parts)
  }
}

struct CorrectionSnapshot: Codable {
  var type: String
  var title: String
  var description: String?
  var status: String
  var fields: [String: String]

  static func from(suggestion: SuggestionDraft) -> CorrectionSnapshot {
    CorrectionSnapshot(
      type: suggestion.type,
      title: suggestion.title,
      description: suggestion.description.trimmedNilIfBlank,
      status: MemoFlowDomain.normalizeApprovedStatus(
        currentStatus: suggestion.status,
        needsClarification: suggestion.needsClarification,
        type: suggestion.type
      ),
      fields: flattenFields(suggestion.suggestedFields)
    )
  }

  static func from(item: ItemRecord) -> CorrectionSnapshot {
    CorrectionSnapshot(
      type: item.type,
      title: item.title,
      description: item.itemDescription.trimmedNilIfBlank,
      status: item.status,
      fields: [
        "category": item.category ?? "",
        "follow_up_needed": item.followUpNeeded.map { $0 ? "true" : "false" } ?? "",
        "due_date": item.dueDateText ?? "",
        "follow_up_date": item.followUpDateText ?? "",
        "waiting_on": item.waitingOn ?? "",
        "url": item.url ?? "",
        "tags": item.tagsCSV ?? ""
      ]
    )
  }

  func changedFields(comparedTo other: CorrectionSnapshot) -> [String] {
    var changed: [String] = []
    if type != other.type { changed.append("type") }
    if title != other.title { changed.append("title") }
    if (description ?? "") != (other.description ?? "") { changed.append("description") }
    if status != other.status { changed.append("status") }

    let fieldKeys = Set(fields.keys).union(other.fields.keys)
    for key in fieldKeys.sorted() {
      if (fields[key] ?? "") != (other.fields[key] ?? "") {
        changed.append("fields.\(key)")
      }
    }

    return changed
  }
}

private func flattenFields(_ fields: SuggestedFieldsDraft) -> [String: String] {
  [
    "category": fields.category ?? "",
    "follow_up_needed": fields.followUpNeeded.map { $0 ? "true" : "false" } ?? "",
    "due_date": fields.dueDate ?? "",
    "follow_up_date": fields.followUpDate ?? "",
    "waiting_on": fields.waitingOn ?? "",
    "url": fields.url ?? "",
    "tags": fields.tags?.joined(separator: ",") ?? "",
  ]
}

private extension String? {
  var trimmedNilIfBlank: String? {
    guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
      return nil
    }
    return value
  }
}
