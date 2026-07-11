import SwiftData
import SwiftUI

@main
struct MemoFlowIOSApp: App {
  @StateObject private var appState = AppState()

  var sharedModelContainer: ModelContainer = {
    let schema = Schema([
      DumpRecord.self,
      ItemRecord.self,
      MemoryRecord.self,
      CorrectionEventRecord.self,
    ])

    let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
    do {
      return try ModelContainer(for: schema, configurations: [configuration])
    } catch {
      fatalError("Failed to create ModelContainer: \(error)")
    }
  }()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(appState)
    }
    .modelContainer(sharedModelContainer)
  }
}
