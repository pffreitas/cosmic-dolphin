import UIKit

/// A single RN host outlives a scene's window. Reconnection must not recreate it.
final class SceneRootHost {
  private var rootViewController: UIViewController?

  func connect(to window: UIWindow, start: () -> Void, reconnect: () -> Void) {
    if let rootViewController {
      window.rootViewController = rootViewController
      window.makeKeyAndVisible()
      reconnect()
    } else {
      start()
      rootViewController = window.rootViewController
    }
  }

  func disconnect(from window: UIWindow) {
    if window.rootViewController === rootViewController {
      window.rootViewController = nil
    }
  }
}
