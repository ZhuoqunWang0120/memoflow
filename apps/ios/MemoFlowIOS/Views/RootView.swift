import SwiftUI

enum RootTab: Hashable {
  case capture
  case pending
  case items
  case memory
}

struct RootView: View {
  @EnvironmentObject private var appState: AppState

  var body: some View {
    TabView(selection: $appState.selectedTab) {
      CaptureView()
        .tabItem {
          Label("Capture", systemImage: "square.and.pencil")
        }
        .tag(RootTab.capture)

      PendingView()
        .tabItem {
          Label("Pending", systemImage: "tray")
        }
        .tag(RootTab.pending)

      ItemsView()
        .tabItem {
          Label("Items", systemImage: "checklist")
        }
        .tag(RootTab.items)

      MemoryView()
        .tabItem {
          Label("Memory", systemImage: "brain")
        }
        .tag(RootTab.memory)
    }
  }
}
