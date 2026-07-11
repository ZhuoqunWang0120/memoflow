import Foundation

struct SuggestionDraft: Codable, Identifiable, Equatable {
  var id: String = UUID().uuidString.lowercased()
  var proposalID: String? = nil
  var type: String
  var title: String
  var description: String?
  var status: String
  var confidence: Double
  var needsClarification: Bool
  var clarificationQuestion: String?
  var missingContext: [String]
  var suggestedFields: SuggestedFieldsDraft
  var relatedExistingItems: [RelatedExistingItemDraft]

  enum CodingKeys: String, CodingKey {
    case type
    case title
    case description
    case status
    case confidence
    case needsClarification = "needs_clarification"
    case clarificationQuestion = "clarification_question"
    case missingContext = "missing_context"
    case suggestedFields = "suggested_fields"
    case relatedExistingItems = "related_existing_items"
  }
}

struct SuggestedFieldsDraft: Codable, Equatable {
  var category: String?
  var followUpNeeded: Bool?
  var dueDate: String?
  var followUpDate: String?
  var waitingOn: String?
  var url: String?
  var tags: [String]?

  enum CodingKeys: String, CodingKey {
    case category
    case followUpNeeded = "follow_up_needed"
    case dueDate = "due_date"
    case followUpDate = "follow_up_date"
    case waitingOn = "waiting_on"
    case url
    case tags
  }
}

struct RelatedExistingItemDraft: Codable, Equatable, Identifiable {
  var itemID: String
  var relationship: String
  var reason: String
  var confidence: Double

  var id: String { itemID }

  enum CodingKeys: String, CodingKey {
    case itemID = "item_id"
    case relationship
    case reason
    case confidence
  }
}

struct SuggestionResultEnvelope: Codable {
  let suggestions: [SuggestionDraft]
}
