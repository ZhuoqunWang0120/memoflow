import SwiftData
import SwiftUI

struct ItemsView: View {
  @Environment(\.modelContext) private var modelContext
  @Query(sort: \ItemRecord.updatedAt, order: .reverse) private var items: [ItemRecord]

  var body: some View {
    NavigationStack {
      List {
        if items.isEmpty {
          ContentUnavailableView("No saved items", systemImage: "checklist")
        } else {
          ForEach(items) { item in
            VStack(alignment: .leading, spacing: 8) {
              HStack {
                Text(item.title)
                  .font(.headline)
                Spacer()
                Text(item.type)
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }

              if let itemDescription = item.itemDescription, !itemDescription.isEmpty {
                Text(itemDescription)
                  .font(.subheadline)
              }

              HStack {
                Text(item.status)
                  .font(.caption)
                  .foregroundStyle(.secondary)
                if let category = item.category, !category.isEmpty {
                  Text("· \(category)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
              }

              HStack {
                if item.archivedAt == nil {
                  Button("Archive", role: .destructive) {
                    MemoFlowDomain.archive(item: item)
                    try? modelContext.save()
                  }
                } else {
                  Button("Unarchive") {
                    MemoFlowDomain.unarchive(item: item)
                    try? modelContext.save()
                  }
                }
                Spacer()
                Text(item.updatedAt.formatted(date: .abbreviated, time: .shortened))
                  .font(.caption2)
                  .foregroundStyle(.secondary)
              }
            }
            .padding(.vertical, 4)
          }
        }
      }
      .navigationTitle("Items")
    }
  }
}
