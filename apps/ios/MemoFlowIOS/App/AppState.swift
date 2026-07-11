import SwiftUI

final class AppState: ObservableObject {
  @Published var selectedTab: RootTab = .capture
  @Published var pendingReviewSelection: PendingReviewSelection?
}

struct PendingReviewSelection: Equatable {
  let dumpID: String
  let rawText: String
}
