import UIKit
import UniformTypeIdentifiers
import os

final class ShareViewController: UIViewController {
  var capture: ShareCapture?
  var voiceOverEnabled: () -> Bool = { UIAccessibility.isVoiceOverRunning }
  var reduceMotionEnabled: () -> Bool = { UIAccessibility.isReduceMotionEnabled }
  var complete: (() -> Void)?
  private let status = UILabel()
  private let titleLabel = UILabel()
  private let domain = UILabel()
  private let detail = UILabel()
  private let close = UIButton(type: .system)
  private let spinner = UIActivityIndicatorView(style: .medium)
  private let stationarySpinner = UIImageView(image: UIImage(systemName: "circle.dotted"))
  private var started = false
  private var finished = false
  private var closed = false
  private var closeRequested = false
  private var closeTask: Task<Void, Never>?

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = ShareTheme.color("bg-panel")
    let brand = label("Cosmic Dolphin", font: "body-sm")
    brand.accessibilityTraits = .header
    status.font = ShareTheme.font("body")
    status.textColor = ShareTheme.color("fg")
    status.text = "Saving…"
    status.numberOfLines = 0
    status.isAccessibilityElement = true
    status.adjustsFontForContentSizeCategory = true
    status.accessibilityIdentifier = "share-status"
    titleLabel.font = ShareTheme.font("title-1", style: .title1)
    titleLabel.textColor = ShareTheme.color("fg")
    titleLabel.numberOfLines = 0
    titleLabel.adjustsFontForContentSizeCategory = true
    titleLabel.accessibilityTraits = .header
    domain.font = ShareTheme.font("meta", style: .caption1)
    domain.textColor = ShareTheme.color("fg-tertiary")
    domain.numberOfLines = 0
    domain.adjustsFontForContentSizeCategory = true
    detail.font = ShareTheme.font("body-sm")
    detail.textColor = ShareTheme.color("fg-secondary")
    detail.numberOfLines = 0
    detail.adjustsFontForContentSizeCategory = true
    close.setTitle("Close", for: .normal)
    close.accessibilityLabel = "Close"
    close.accessibilityIdentifier = "share-close"
    close.titleLabel?.font = ShareTheme.font("body-sm", maximumScale: 1.3)
    close.titleLabel?.adjustsFontForContentSizeCategory = true
    close.titleLabel?.numberOfLines = 0
    close.setTitleColor(ShareTheme.color("fg"), for: .normal)
    close.layer.cornerRadius = ShareTheme.radius
    close.layer.borderWidth = 1
    close.addTarget(self, action: #selector(closePanel), for: .touchUpInside)
    close.heightAnchor.constraint(greaterThanOrEqualToConstant: ShareTheme.touchTarget).isActive = true
    spinner.color = ShareTheme.color("accent")
    spinner.isAccessibilityElement = false
    spinner.accessibilityIdentifier = "share-progress"
    stationarySpinner.contentMode = .center
    stationarySpinner.tintColor = ShareTheme.color("accent")
    stationarySpinner.alpha = 0.6
    stationarySpinner.isAccessibilityElement = false
    stationarySpinner.accessibilityIdentifier = "share-progress-static"
    stationarySpinner.heightAnchor.constraint(equalToConstant: ShareTheme.space(4)).isActive = true
    let stack = UIStackView(arrangedSubviews: [brand, titleLabel, domain, status, detail, spinner, stationarySpinner, close])
    stack.axis = .vertical
    stack.spacing = ShareTheme.space(3)
    let scroll = UIScrollView()
    scroll.translatesAutoresizingMaskIntoConstraints = false
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(scroll); scroll.addSubview(stack)
    let inset = ShareTheme.space(4)
    NSLayoutConstraint.activate([
      scroll.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
      scroll.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
      scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      scroll.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
      stack.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor, constant: inset),
      stack.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor, constant: -inset),
      stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: inset),
      stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -inset),
      stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, constant: -2 * inset),
    ])
    NotificationCenter.default.addObserver(self, selector: #selector(accessibilityChanged), name: UIAccessibility.reduceMotionStatusDidChangeNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(accessibilityChanged), name: UIAccessibility.voiceOverStatusDidChangeNotification, object: nil)
    accessibilityChanged()
    close.layer.borderColor = ShareTheme.color("border-strong").resolvedColor(with: traitCollection).cgColor
  }
  private func label(_ text: String, font: String) -> UILabel {
    let label = UILabel(); label.text = text; label.font = ShareTheme.font(font)
    label.textColor = ShareTheme.color("fg-secondary"); label.numberOfLines = 0
    label.adjustsFontForContentSizeCategory = true
    return label
  }
  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    Task { await start(items: extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []) }
  }
  @MainActor
  func start(items: [NSExtensionItem]) async {
    guard !started else { return }
    started = true
    let began = ProcessInfo.processInfo.systemUptime
    let link = await Self.firstLink(items: items)
    titleLabel.text = link.title ?? link.url?.absoluteString
    titleLabel.isHidden = link.url == nil
    domain.text = link.url?.host
    domain.isHidden = link.url == nil
    let result: ShareResult
    if let capture { result = await capture.save(url: link.url) }
    else if link.url == nil { result = .noURL }
    else if let group = Bundle.main.object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String {
      result = await ShareCapture(keychain: SharedKeychain(accessGroup: group)).save(url: link.url)
    } else { result = .notSaved }
    finished = true
    spinner.stopAnimating()
    spinner.isHidden = true
    stationarySpinner.isHidden = true
    switch result {
    case .saved: status.text = "Saved to Cosmic Dolphin"; detail.text = "You can close the tab now. Cosmic reads it next."
    case .alreadySaved: status.text = "Already in your Library"
    case .queued: status.text = "Saved on this phone. Cosmic reads it when you open the app."
    case .noURL: status.text = "Cosmic Dolphin can only save links"
    case .full: status.text = "Open Cosmic Dolphin to finish saving"
    case .notSaved: status.text = "Couldn’t save this link. Try sharing it again."
    }
    detail.isHidden = detail.text == nil
    UIAccessibility.post(notification: .announcement, argument: [status.text, detail.text].compactMap { $0 }.joined(separator: ". "))
    let elapsed = (ProcessInfo.processInfo.systemUptime - began) * 1000
    Logger(subsystem: "com.cosmicdolphin.share", category: "capture").notice("status=\(String(describing: result), privacy: .public) elapsed_ms=\(elapsed, privacy: .public)")
    if closeRequested { closePanel() }
    else if [.saved, .alreadySaved, .queued].contains(result), !voiceOverEnabled() {
      closeTask = Task { [weak self] in
        try? await Task.sleep(nanoseconds: 1_500_000_000)
        guard !Task.isCancelled, let self, !self.voiceOverEnabled() else { return }
        self.closePanel()
      }
    }
  }
  @objc private func accessibilityChanged() {
    if voiceOverEnabled() { closeTask?.cancel() }
    if finished { return }
    if reduceMotionEnabled() { spinner.stopAnimating(); spinner.isHidden = true; stationarySpinner.isHidden = false }
    else { stationarySpinner.isHidden = true; spinner.isHidden = false; spinner.startAnimating() }
  }
  @objc private func closePanel() {
    // Closing during a request waits for its durable result; it never launches the host.
    if !finished { closeRequested = true; return }
    guard !closed else { return }
    closed = true
    closeTask?.cancel()
    if let complete { complete() }
    else { extensionContext?.completeRequest(returningItems: nil, completionHandler: nil) }
  }
  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    close.layer.borderColor = ShareTheme.color("border-strong").resolvedColor(with: traitCollection).cgColor
  }
  deinit { closeTask?.cancel(); NotificationCenter.default.removeObserver(self) }

  @MainActor
  static func firstLink(items: [NSExtensionItem]) async -> (url: URL?, title: String?) {
    func valid(_ value: String?) -> URL? {
      guard let value, let url = URL(string: value), ["http", "https"].contains(url.scheme?.lowercased() ?? ""), let host = url.host, !host.isEmpty else { return nil }
      return url
    }
    for item in items {
      for attachment in item.attachments ?? [] {
        if attachment.hasItemConformingToTypeIdentifier(UTType.propertyList.identifier),
          let payload = try? await attachment.loadItem(forTypeIdentifier: UTType.propertyList.identifier) as? NSDictionary,
          let results = payload[NSExtensionJavaScriptPreprocessingResultsKey] as? NSDictionary,
          let url = valid(results["baseURI"] as? String) {
          return (url, results["title"] as? String ?? item.attributedTitle?.string)
        }
        if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier),
          let value = try? await attachment.loadItem(forTypeIdentifier: UTType.url.identifier),
          let url = valid((value as? URL)?.absoluteString ?? value as? String) {
          return (url, item.attributedTitle?.string)
        }
        if attachment.hasItemConformingToTypeIdentifier(UTType.text.identifier),
          let text = try? await attachment.loadItem(forTypeIdentifier: UTType.text.identifier) as? String,
          let regex = try? NSRegularExpression(pattern: "https?://[^\\s<>]+", options: .caseInsensitive) {
          for match in regex.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
            if let range = Range(match.range, in: text), let url = valid(String(text[range]).trimmingCharacters(in: CharacterSet(charactersIn: ".,);!?"))) { return (url, item.attributedTitle?.string) }
          }
        }
      }
    }
    return (nil, nil)
  }
}
