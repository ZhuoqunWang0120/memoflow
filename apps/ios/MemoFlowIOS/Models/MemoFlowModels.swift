import Foundation
import SwiftData

@Model
final class DumpRecord {
  @Attribute(.unique) var id: String
  var rawText: String
  var status: String
  var source: String?
  var createdAt: Date
  var updatedAt: Date
  var reviewedAt: Date?
  var ignoredAt: Date?

  init(
    id: String = "dump_\(UUID().uuidString.lowercased())",
    rawText: String,
    status: String = "pending",
    source: String? = "ios",
    createdAt: Date = Date(),
    updatedAt: Date = Date(),
    reviewedAt: Date? = nil,
    ignoredAt: Date? = nil
  ) {
    self.id = id
    self.rawText = rawText
    self.status = status
    self.source = source
    self.createdAt = createdAt
    self.updatedAt = updatedAt
    self.reviewedAt = reviewedAt
    self.ignoredAt = ignoredAt
  }
}

@Model
final class ItemRecord {
  @Attribute(.unique) var id: String
  var type: String
  var title: String
  var itemDescription: String?
  var status: String
  var category: String?
  var followUpNeeded: Bool?
  var dueDateText: String?
  var followUpDateText: String?
  var waitingOn: String?
  var url: String?
  var tagsCSV: String?
  var sourceKind: String
  var sourceRawText: String?
  var sourceSuggestionJSON: String?
  var createdAt: Date
  var updatedAt: Date
  var archivedAt: Date?

  init(
    id: String = "itm_\(UUID().uuidString.lowercased())",
    type: String,
    title: String,
    itemDescription: String? = nil,
    status: String,
    category: String? = nil,
    followUpNeeded: Bool? = nil,
    dueDateText: String? = nil,
    followUpDateText: String? = nil,
    waitingOn: String? = nil,
    url: String? = nil,
    tagsCSV: String? = nil,
    sourceKind: String,
    sourceRawText: String? = nil,
    sourceSuggestionJSON: String? = nil,
    createdAt: Date = Date(),
    updatedAt: Date = Date(),
    archivedAt: Date? = nil
  ) {
    self.id = id
    self.type = type
    self.title = title
    self.itemDescription = itemDescription
    self.status = status
    self.category = category
    self.followUpNeeded = followUpNeeded
    self.dueDateText = dueDateText
    self.followUpDateText = followUpDateText
    self.waitingOn = waitingOn
    self.url = url
    self.tagsCSV = tagsCSV
    self.sourceKind = sourceKind
    self.sourceRawText = sourceRawText
    self.sourceSuggestionJSON = sourceSuggestionJSON
    self.createdAt = createdAt
    self.updatedAt = updatedAt
    self.archivedAt = archivedAt
  }
}

@Model
final class MemoryRecord {
  @Attribute(.unique) var id: String
  var text: String
  var createdAt: Date
  var updatedAt: Date
  var archivedAt: Date?

  init(
    id: String = "mem_\(UUID().uuidString.lowercased())",
    text: String,
    createdAt: Date = Date(),
    updatedAt: Date = Date(),
    archivedAt: Date? = nil
  ) {
    self.id = id
    self.text = text
    self.createdAt = createdAt
    self.updatedAt = updatedAt
    self.archivedAt = archivedAt
  }
}

@Model
final class CorrectionEventRecord {
  @Attribute(.unique) var id: String
  var createdAt: Date
  var source: String
  var proposalID: String?
  var dumpID: String?
  var savedItemID: String?
  var beforeJSON: String
  var afterJSON: String
  var changedFieldsCSV: String
  var learningStatus: String

  init(
    id: String = "corr_\(UUID().uuidString.lowercased())",
    createdAt: Date = Date(),
    source: String,
    proposalID: String? = nil,
    dumpID: String? = nil,
    savedItemID: String? = nil,
    beforeJSON: String,
    afterJSON: String,
    changedFieldsCSV: String,
    learningStatus: String = "unreviewed"
  ) {
    self.id = id
    self.createdAt = createdAt
    self.source = source
    self.proposalID = proposalID
    self.dumpID = dumpID
    self.savedItemID = savedItemID
    self.beforeJSON = beforeJSON
    self.afterJSON = afterJSON
    self.changedFieldsCSV = changedFieldsCSV
    self.learningStatus = learningStatus
  }
}
