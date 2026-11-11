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
      let colors = tokens["color"] as! [String: [String: String]]
      let hex = colors[traits.userInterfaceStyle == .dark ? "dark" : "light"]![name]!
      let value = UInt32(hex.dropFirst(), radix: 16)!
      return UIColor(red: CGFloat((value >> 16) & 255) / 255,
        green: CGFloat((value >> 8) & 255) / 255, blue: CGFloat(value & 255) / 255, alpha: 1)
    }
  }
  private static let fonts: [String: String] = {
    var result: [String: String] = [:]
    for (family, file) in [("sans", "Inter-400"), ("serif", "SourceSerif4-400")] {
      let url = bundle.url(forResource: file, withExtension: "ttf")!
      CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
      let descriptors = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as! [CTFontDescriptor]
      result[family] = CTFontDescriptorCopyAttribute(descriptors[0], kCTFontNameAttribute) as? String
    }
    return result
  }()
  static func font(_ name: String, style: UIFont.TextStyle = .body) -> UIFont {
    let type = tokens["typography"] as! [String: Any]
    let scale = type["scale"] as! [String: [String: Any]]
    let token = scale[name]!
    return UIFontMetrics(forTextStyle: style).scaledFont(for: UIFont(name: fonts[token["family"] as! String]!, size: number(token["size"]))!)
  }
}
