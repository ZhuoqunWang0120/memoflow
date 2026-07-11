import SwiftData
import XCTest

@testable import MemoFlowIOS

@MainActor
final class CaptureViewModelTests: XCTestCase {
  private var container: ModelContainer!
  private var modelContext: ModelContext!

  override func setUpWithError() throws {
    let schema = Schema([
      DumpRecord.self,
      ItemRecord.self,
      MemoryRecord.self,
      CorrectionEventRecord.self,
    ])
    let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
    container = try ModelContainer(for: schema, configurations: [configuration])
    modelContext = ModelContext(container)
  }

  override func tearDownWithError() throws {
    modelContext = nil
    container = nil
  }

  func testApproveSuggestionSavesItemMarksDumpReviewedAndRemovesSuggestion() throws {
    let viewModel = CaptureViewModel()
    let dump = DumpRecord(rawText: "Call Alice about contract")
    let suggestion = SuggestionDraft(
      type: "task",
      title: "Call Alice",
      description: "Discuss the contract",
      status: "",
      confidence: 0.95,
      needsClarification: false,
      clarificationQuestion: nil,
      missingContext: [],
      suggestedFields: SuggestedFieldsDraft(
        category: "work",
        followUpNeeded: true,
        dueDate: nil,
        followUpDate: nil,
        waitingOn: nil,
        url: nil,
        tags: ["client"]
      ),
      relatedExistingItems: []
    )

    modelContext.insert(dump)
    viewModel.rawText = dump.rawText
    viewModel.activeDumpID = dump.id
    viewModel.suggestions = [suggestion]

    try viewModel.approveSuggestion(id: suggestion.id, modelContext: modelContext, dumps: [dump])

    let items = try modelContext.fetch(FetchDescriptor<ItemRecord>())

    XCTAssertEqual(items.count, 1)
    XCTAssertEqual(items.first?.title, "Call Alice")
    XCTAssertEqual(items.first?.type, "task")
    XCTAssertEqual(items.first?.status, "ready")
    XCTAssertEqual(items.first?.sourceRawText, dump.rawText)
    XCTAssertTrue(viewModel.suggestions.isEmpty)
    XCTAssertEqual(dump.status, "reviewed")
    XCTAssertNotNil(dump.reviewedAt)
  }

  func testDiscardSuggestionByIDRemovesOnlyMatchingSuggestion() {
    let viewModel = CaptureViewModel()
    let first = SuggestionDraft(
      type: "task",
      title: "First",
      description: nil,
      status: "ready",
      confidence: 0.9,
      needsClarification: false,
      clarificationQuestion: nil,
      missingContext: [],
      suggestedFields: SuggestedFieldsDraft(
        category: nil,
        followUpNeeded: nil,
        dueDate: nil,
        followUpDate: nil,
        waitingOn: nil,
        url: nil,
        tags: nil
      ),
      relatedExistingItems: []
    )
    let second = SuggestionDraft(
      type: "idea",
      title: "Second",
      description: nil,
      status: "saved",
      confidence: 0.8,
      needsClarification: false,
      clarificationQuestion: nil,
      missingContext: [],
      suggestedFields: SuggestedFieldsDraft(
        category: nil,
        followUpNeeded: nil,
        dueDate: nil,
        followUpDate: nil,
        waitingOn: nil,
        url: nil,
        tags: nil
      ),
      relatedExistingItems: []
    )

    viewModel.suggestions = [first, second]

    viewModel.discardSuggestion(id: first.id)

    XCTAssertEqual(viewModel.suggestions.map(\.title), ["Second"])
    XCTAssertEqual(viewModel.suggestions.first?.id, second.id)
  }
}
