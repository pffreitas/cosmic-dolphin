import UIKit
import XCTest

final class SceneLaunchOptionsTests: XCTestCase {
  func testOrdinaryLaunchRetainsApplicationOptions() {
    let options = SceneLaunchOptions.make(
      applicationOptions: [.remoteNotification: ["id": "retained"]],
      url: nil, sourceApplication: nil, annotation: nil, userActivity: nil
    )
    XCTAssertEqual((options[.remoteNotification] as? [String: String])?["id"], "retained")
    XCTAssertNil(options[.url])
    XCTAssertNil(options[.userActivityDictionary])
  }

  func testColdCustomURLUsesReactNativeInitialURLContract() {
    let url = URL(string: "cosmicdolphin://auth/callback?code=test")!
    let options = SceneLaunchOptions.make(
      applicationOptions: nil, url: url, sourceApplication: "com.apple.mobilesafari",
      annotation: "retained", userActivity: nil
    )
    XCTAssertEqual(options[.url] as? URL, url)
    XCTAssertEqual(options[.sourceApplication] as? String, "com.apple.mobilesafari")
    XCTAssertEqual(options[.annotation] as? String, "retained")
  }

  func testColdUniversalLinkUsesReactNativeUserActivityDictionary() {
    let activity = NSUserActivity(activityType: NSUserActivityTypeBrowsingWeb)
    activity.webpageURL = URL(string: "https://cosmicdolphin.app/public/example")!
    let options = SceneLaunchOptions.make(
      applicationOptions: nil, url: nil, sourceApplication: nil,
      annotation: nil, userActivity: activity
    )
    let dictionary = options[.userActivityDictionary] as? [String: Any]
    XCTAssertEqual(dictionary?[UIApplication.LaunchOptionsKey.userActivityType.rawValue] as? String, NSUserActivityTypeBrowsingWeb)
    XCTAssertTrue(dictionary?["UIApplicationLaunchOptionsUserActivityKey"] as? NSUserActivity === activity)
  }

  func testSceneURLOverridesStaleApplicationURLWithoutDiscardingOtherOptions() {
    let fresh = URL(string: "cosmicdolphin://save?url=https%3A%2F%2Fexample.com")!
    let options = SceneLaunchOptions.make(
      applicationOptions: [.url: URL(string: "cosmicdolphin://stale")!, .remoteNotification: "retained"],
      url: fresh, sourceApplication: nil, annotation: nil, userActivity: nil
    )
    XCTAssertEqual(options[.url] as? URL, fresh)
    XCTAssertEqual(options[.remoteNotification] as? String, "retained")
  }

  func testWarmURLOptionsPreserveContextWithoutInventingSource() {
    let options = SceneLaunchOptions.urlOptions(sourceApplication: "com.apple.mobilesafari", annotation: "context", openInPlace: true)
    XCTAssertEqual(options[.sourceApplication] as? String, "com.apple.mobilesafari")
    XCTAssertEqual(options[.annotation] as? String, "context")
    XCTAssertEqual(options[.openInPlace] as? Bool, true)
    let absent = SceneLaunchOptions.urlOptions(sourceApplication: nil, annotation: nil, openInPlace: false)
    XCTAssertNil(absent[.sourceApplication])
    XCTAssertNil(absent[.annotation])
    XCTAssertEqual(absent[.openInPlace] as? Bool, false)
  }
}

final class SceneRootHostTests: XCTestCase {
  func testConnectDisconnectReconnectRetainsRootAndDeliversOnlyNewIntent() {
    let host = SceneRootHost()
    let firstWindow = UIWindow()
    let root = UIViewController()
    let draft = UITextField()
    draft.text = "local unsent intent"
    root.view.addSubview(draft)
    var starts = 0
    var delivered: [String] = []
    host.connect(to: firstWindow, start: {
      starts += 1
      firstWindow.rootViewController = root
      delivered.append("cold://first")
    }, reconnect: { XCTFail("First connection must use initial launch options") })
    host.disconnect(from: firstWindow)
    XCTAssertNil(firstWindow.rootViewController)
    let secondWindow = UIWindow()
    host.connect(to: secondWindow, start: {
      starts += 1
      XCTFail("Scene reconnect must not initialize RN again")
    }, reconnect: {
      XCTAssertTrue(secondWindow.rootViewController === root)
      delivered.append("warm://new-scene-link")
    })
    XCTAssertEqual(starts, 1)
    XCTAssertTrue(secondWindow.rootViewController === root)
    XCTAssertEqual(draft.text, "local unsent intent")
    XCTAssertEqual(delivered, ["cold://first", "warm://new-scene-link"])
  }

  func testDisconnectOfAnOldWindowDoesNotDetachReconnectedRoot() {
    let host = SceneRootHost()
    let firstWindow = UIWindow()
    let root = UIViewController()
    host.connect(to: firstWindow, start: { firstWindow.rootViewController = root }, reconnect: {})
    host.disconnect(from: firstWindow)
    let secondWindow = UIWindow()
    host.connect(to: secondWindow, start: { XCTFail("Must reuse root") }, reconnect: {})
    host.disconnect(from: firstWindow)
    XCTAssertTrue(secondWindow.rootViewController === root)
  }
}
