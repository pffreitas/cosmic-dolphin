import UIKit
import CoreText

/// Native views consume the canonical token resource and the same bundled fonts as the app.
enum ShareTheme {
  private static let bundle = Bundle(for: ShareViewController.self)
  private static let tokens: [String: Any] = {
    let url = bundle.url(forResource: "tokens", withExtension: "json")!
    return try! JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
  }()
  private static func number(_ value: Any?) -> CGFloat {
    CGFloat(Double((value as? String ?? "").replacingOccurrences(of: "px", with: ""))!)
  }
  static func space(_ index: Int) -> CGFloat { number(((tokens["space"] as! [String: Any])["scale"] as! [String: Any])["s-\(index)"]) }
  static let touchTarget: CGFloat = 44 // Signal's binding minimum for native touch controls.
  static let radius = number(((tokens["shape"] as! [String: Any])["radius"] as! [String: Any])["r-sm"])
  static func color(_ name: String) -> UIColor {
    UIColor { traits in
      let mode = traits.userInterfaceStyle == .dark ? "dark" : "light"
      let colors = tokens["color"] as! [String: Any]
      let canonical = colors[mode] as! [String: String]
      let mobile = colors["mobile"] as? [String: Any]
      let overrides = mobile?[mode] as? [String: String] ?? [:]
      precondition(overrides.keys.allSatisfy { canonical[$0] != nil }, "Unknown mobile color token")
      let effective = canonical.merging(overrides) { _, override in override }
      func resolve(_ key: String, seen: Set<String> = []) -> String {
        precondition(!seen.contains(key), "Circular color alias")
        let value = effective[key]!
        if value.hasPrefix("{"), value.hasSuffix("}") {
          return resolve(String(value.dropFirst().dropLast()), seen: seen.union([key]))
        }
        return value
      }
      let hex = resolve(name)
      let value = UInt32(hex.dropFirst(), radix: 16)!
      return UIColor(red: CGFloat((value >> 16) & 255) / 255,
        green: CGFloat((value >> 8) & 255) / 255, blue: CGFloat(value & 255) / 255, alpha: 1)
    }
  }
  private static let fonts: [String: String] = {
    var result: [String: String] = [:]
    for (family, file) in [("sans-400", "Inter-400"), ("serif-400", "SourceSerif4-400"), ("serif-600", "SourceSerif4-600")] {
      let url = bundle.url(forResource: file, withExtension: "ttf")!
      CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
      let descriptors = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as! [CTFontDescriptor]
      result[family] = CTFontDescriptorCopyAttribute(descriptors[0], kCTFontNameAttribute) as? String
    }
    return result
  }()
  static func font(_ name: String, style: UIFont.TextStyle = .body, maximumScale: CGFloat? = nil, compatibleWith traits: UITraitCollection? = nil) -> UIFont {
    let type = tokens["typography"] as! [String: Any]
    let scale = type["scale"] as! [String: [String: Any]]
    let token = scale[name]!
    let base = UIFont(name: fonts["\(token["family"] as! String)-\(token["weight"]!)"]!, size: number(token["size"]))!
    let metrics = UIFontMetrics(forTextStyle: style)
    if let maximumScale { return metrics.scaledFont(for: base, maximumPointSize: base.pointSize * maximumScale, compatibleWith: traits) }
    return metrics.scaledFont(for: base, compatibleWith: traits)
  }
}
