import SwiftData
import SwiftUI

struct MemoryView: View {
  @Environment(\.modelContext) private var modelContext
  @Query(sort: \MemoryRecord.updatedAt, order: .reverse) private var memories: [MemoryRecord]
  @State private var newMemoryText = ""

  var body: some View {
    NavigationStack {
      List {
        Section("Add memory") {
          TextField("Memory text", text: $newMemoryText, axis: .vertical)
          Button("Save memory") {
            let trimmed = newMemoryText.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            modelContext.insert(MemoryRecord(text: trimmed))
            try? modelContext.save()
            newMemoryText = ""
          }
        }

        if memories.isEmpty {
          ContentUnavailableView("No memory yet", systemImage: "brain")
        } else {
          ForEach(memories) { memory in
            VStack(alignment: .leading, spacing: 8) {
              Text(memory.text)
              HStack {
                if memory.archivedAt == nil {
                  Button("Archive", role: .destructive) {
                    memory.archivedAt = Date()
                    memory.updatedAt = Date()
                    try? modelContext.save()
                  }
                } else {
                  Text("Archived")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                Spacer()

                Button("Delete", role: .destructive) {
                  modelContext.delete(memory)
                  try? modelContext.save()
                }
              }
            }
            .padding(.vertical, 4)
          }
        }
      }
      .navigationTitle("Memory")
    }
  }
}
