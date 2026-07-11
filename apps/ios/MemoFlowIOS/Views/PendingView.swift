import SwiftData
import SwiftUI

struct PendingView: View {
  @Environment(\.modelContext) private var modelContext
  @EnvironmentObject private var appState: AppState
  @Query(sort: \DumpRecord.updatedAt, order: .reverse) private var dumps: [DumpRecord]

  private var pendingDumps: [DumpRecord] {
    dumps.filter { $0.status == "pending" }
  }

  var body: some View {
    NavigationStack {
      List {
        if pendingDumps.isEmpty {
          ContentUnavailableView("No pending dumps", systemImage: "tray")
        } else {
          ForEach(pendingDumps) { dump in
            VStack(alignment: .leading, spacing: 10) {
              Text(dump.rawText)
                .lineLimit(3)
              Text(dump.updatedAt.formatted(date: .abbreviated, time: .shortened))
                .font(.caption)
                .foregroundStyle(.secondary)

              HStack {
                Button("Review") {
                  appState.pendingReviewSelection = PendingReviewSelection(dumpID: dump.id, rawText: dump.rawText)
                  appState.selectedTab = .capture
                }
                Spacer()
                Button("Ignore", role: .destructive) {
                  MemoFlowDomain.ignore(dump: dump)
                  try? modelContext.save()
                }
              }
            }
            .padding(.vertical, 4)
          }
        }
      }
      .navigationTitle("Pending")
    }
  }
}
