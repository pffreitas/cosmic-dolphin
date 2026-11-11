import UIKit

/** Test-only host: XCTest needs an entitled executable for Security calls. */
@main
final class ShareQueueTestHost: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool { true }
}
