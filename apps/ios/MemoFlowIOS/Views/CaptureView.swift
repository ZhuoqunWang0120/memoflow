import SwiftData
import SwiftUI

@MainActor
final class CaptureViewModel: ObservableObject {
  @Published var rawText = ""
  @Published var useMemory = false
  @Published var useContext = false
  @Published var suggestions: [SuggestionDraft] = []
  @Published var isGenerating = false
  @Published var errorMessage: String?
  @Published var activeDumpID: String?

  private let aiClient = MemoFlowAIClient()

  func loadPendingSelection(_ selection: PendingReviewSelection) {
    rawText = selection.rawText
    activeDumpID = selection.dumpID
    errorMessage = nil
  }

  func clearReviewState() {
    activeDumpID = nil
    suggestions = []
    errorMessage = nil
  }

  func saveDump(modelContext: ModelContext) throws {
    let trimmed = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    let dump = DumpRecord(rawText: trimmed, source: "ios")
    modelContext.insert(dump)
    try modelContext.save()
    activeDumpID = dump.id
  }

  func generate(items: [ItemRecord], memories: [MemoryRecord]) async {
    let trimmed = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    isGenerating = true
    errorMessage = nil
    defer { isGenerating = false }

    do {
      let context = MemoFlowDomain.buildContext(items: items, memories: memories, rawText: trimmed)
      suggestions = try await aiClient.generateSuggestions(
        rawText: trimmed,
        useMemory: useMemory,
        useContext: useContext,
        context: context
      )
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  func approveSuggestion(at index: Int, modelContext: ModelContext, dumps: [DumpRecord]) throws {
    guard suggestions.indices.contains(index) else { return }
    let suggestion = suggestions[index]
    try approveSuggestion(id: suggestion.id, modelContext: modelContext, dumps: dumps)
  }

  func approveSuggestion(id: String, modelContext: ModelContext, dumps: [DumpRecord]) throws {
    guard let index = suggestions.firstIndex(where: { $0.id == id }) else { return }
    let suggestion = suggestions[index]
    let trimmed = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
    _ = try MemoFlowDomain.saveApprovedSuggestion(
      suggestion: suggestion,
      rawText: trimmed,
      dumpID: activeDumpID,
      modelContext: modelContext
    )

    if let activeDumpID,
       let dump = dumps.first(where: { $0.id == activeDumpID }) {
      MemoFlowDomain.markReviewed(dump: dump)
    }

    suggestions.remove(at: index)
    try modelContext.save()
  }

  func discardSuggestion(at index: Int) {
    guard suggestions.indices.contains(index) else { return }
    suggestions.remove(at: index)
  }

  func discardSuggestion(id: String) {
    guard let index = suggestions.firstIndex(where: { $0.id == id }) else { return }
    suggestions.remove(at: index)
  }

  func markActiveDumpReviewed(modelContext: ModelContext, dumps: [DumpRecord]) throws {
    guard let activeDumpID,
          let dump = dumps.first(where: { $0.id == activeDumpID }) else { return }
    MemoFlowDomain.markReviewed(dump: dump)
    try modelContext.save()
    self.activeDumpID = nil
  }
}

struct CaptureView: View {
  @Environment(\.modelContext) private var modelContext
  @EnvironmentObject private var appState: AppState

  @Query(sort: \ItemRecord.updatedAt, order: .reverse) private var items: [ItemRecord]
  @Query(sort: \MemoryRecord.updatedAt, order: .reverse) private var memories: [MemoryRecord]
  @Query(sort: \DumpRecord.updatedAt, order: .reverse) private var dumps: [DumpRecord]

  @StateObject private var viewModel = CaptureViewModel()

  var body: some View {
    NavigationStack {
      List {
        Section("Raw dump") {
          TextEditor(text: $viewModel.rawText)
            .frame(minHeight: 160)

          if let activeDumpID = viewModel.activeDumpID {
            Text("Reviewing pending dump: \(activeDumpID)")
              .font(.caption)
              .foregroundStyle(.secondary)
          }

          Toggle("Use memory", isOn: $viewModel.useMemory)
          Toggle("Use context", isOn: $viewModel.useContext)

          Button("Save dump for later") {
            do {
              try viewModel.saveDump(modelContext: modelContext)
            } catch {
              viewModel.errorMessage = error.localizedDescription
            }
          }

          Button(viewModel.isGenerating ? "Generating..." : "Generate suggestions") {
            Task {
              await viewModel.generate(items: items, memories: memories)
            }
          }
          .disabled(viewModel.isGenerating)

          if viewModel.activeDumpID != nil {
            Button("Mark current dump reviewed") {
              do {
                try viewModel.markActiveDumpReviewed(modelContext: modelContext, dumps: dumps)
              } catch {
                viewModel.errorMessage = error.localizedDescription
              }
            }
          }

          if let errorMessage = viewModel.errorMessage {
            Text(errorMessage)
              .foregroundStyle(.red)
              .font(.footnote)
          }
        }

        if !viewModel.suggestions.isEmpty {
          Section("Suggestions") {
            ForEach(viewModel.suggestions.map(\.id), id: \.self) { suggestionID in
              if let suggestionBinding = suggestionBinding(for: suggestionID) {
                SuggestionEditorCard(
                suggestion: suggestionBinding,
                onApprove: {
                  do {
                    try viewModel.approveSuggestion(id: suggestionID, modelContext: modelContext, dumps: dumps)
                    appState.selectedTab = .items
                  } catch {
                    viewModel.errorMessage = error.localizedDescription
                  }
                },
                  onDiscard: {
                    viewModel.discardSuggestion(id: suggestionID)
                  }
                )
              }
            }
          }
        }
      }
      .navigationTitle("MemoFlow")
      .onChange(of: appState.pendingReviewSelection) { _, selection in
        guard let selection else { return }
        viewModel.loadPendingSelection(selection)
        appState.pendingReviewSelection = nil
      }
    }
  }

  private func suggestionBinding(for suggestionID: String) -> Binding<SuggestionDraft>? {
    guard let index = viewModel.suggestions.firstIndex(where: { $0.id == suggestionID }) else {
      return nil
    }
    return $viewModel.suggestions[index]
  }
}

private struct SuggestionEditorCard: View {
  @Binding var suggestion: SuggestionDraft
  let onApprove: () -> Void
  let onDiscard: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Picker("Type", selection: $suggestion.type) {
        Text("Task").tag("task")
        Text("Exploration").tag("exploration")
        Text("Idea").tag("idea")
        Text("Reference").tag("reference")
      }
      .pickerStyle(.menu)

      TextField("Title", text: $suggestion.title)
      TextField("Description", text: binding(for: $suggestion.description))
      TextField("Status", text: $suggestion.status)
      TextField("Category", text: binding(for: $suggestion.suggestedFields.category))
      TextField("Due date", text: binding(for: $suggestion.suggestedFields.dueDate))
      TextField("Waiting on", text: binding(for: $suggestion.suggestedFields.waitingOn))
      TextField("URL", text: binding(for: $suggestion.suggestedFields.url))

      Toggle(
        "Follow up needed",
        isOn: Binding(
          get: { suggestion.suggestedFields.followUpNeeded ?? false },
          set: { suggestion.suggestedFields.followUpNeeded = $0 }
        )
      )

      if suggestion.needsClarification {
        Text(suggestion.clarificationQuestion ?? "Needs clarification")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }

      if !suggestion.relatedExistingItems.isEmpty {
        VStack(alignment: .leading, spacing: 4) {
          Text("Related items")
            .font(.caption)
            .foregroundStyle(.secondary)

          ForEach(suggestion.relatedExistingItems) { related in
            Text("\(related.itemID): \(related.relationship) (\(Int(related.confidence * 100))%)")
              .font(.caption)
          }
        }
      }

      HStack {
        Button("Discard", role: .destructive, action: onDiscard)
        Spacer()
        Button("Approve", action: onApprove)
      }
    }
    .padding(.vertical, 6)
  }

  private func binding(for value: Binding<String?>) -> Binding<String> {
    Binding<String>(
      get: { value.wrappedValue ?? "" },
      set: { newValue in
        let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
        value.wrappedValue = trimmed.isEmpty ? nil : trimmed
      }
    )
  }
}
