import UIKit

enum SceneLaunchOptions {
  static func make(
    applicationOptions: [UIApplication.LaunchOptionsKey: Any]?,
    url: URL?, sourceApplication: String?, annotation: Any?, userActivity: NSUserActivity?
  ) -> [UIApplication.LaunchOptionsKey: Any] {
    var options = applicationOptions ?? [:]
    if let url {
      options[.url] = url
      options[.sourceApplication] = sourceApplication
      options[.annotation] = annotation
    }
    if let userActivity {
      // RCTLinkingManager.getInitialURL still consumes this legacy dictionary
      // in RN0.81. Build it from the scene's cold connection intent.
      options[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType.rawValue: userActivity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": userActivity,
      ]
    }
    return options
  }

  static func urlOptions(
    sourceApplication: String?, annotation: Any?, openInPlace: Bool
  ) -> [UIApplication.OpenURLOptionsKey: Any] {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: openInPlace]
    options[.sourceApplication] = sourceApplication
    options[.annotation] = annotation
    return options
  }
}
