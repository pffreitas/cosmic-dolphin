import Foundation

enum ShareResult: Equatable { case saved, alreadySaved, queued, noURL, full, notSaved }

final class ShareCapture {
  let keychain: SharedKeychain
  let session: URLSession
  let directory: URL?
  let pending: PendingShares?
  init(keychain: SharedKeychain, session: URLSession = .shared, directory: URL? = nil, pending: PendingShares? = nil) {
    self.keychain = keychain
    self.session = session
    self.directory = directory
    self.pending = pending
  }
  func save(url: URL?) async -> ShareResult {
    guard let url, ["http", "https"].contains(url.scheme?.lowercased() ?? ""), let host = url.host, !host.isEmpty else { return .noURL }
    // flock can wait for another process; never wait on the extension's main thread.
    return await Task.detached { await self.saveLocked(url: url) }.value
  }
  private func saveLocked(url: URL) async -> ShareResult {
    let lease: PendingShares.Lease
    do {
      lease = try (pending ?? PendingShares(directory: try directory ?? PendingShares.sharedDirectory())).acquire()
      guard try lease.snapshot().count < PendingShares.limit else { lease.release(); return .full }
    } catch { return .notSaved }
    defer { lease.release() }
    let item = try? keychain.read()
    let entry = PendingShare(id: UUID().uuidString, url: url.absoluteString, userId: item?.userId,
      queuedAt: ISO8601DateFormatter().string(from: Date()), notBefore: nil)
    do { try lease.append(entry) } catch { return .notSaved }
    var transport: (Data, URLResponse)?
    if let item, let endpoint = URL(string: item.apiBaseUrl + "/api/v1/bookmarks") {
      var request = URLRequest(url: endpoint, timeoutInterval: 8)
      request.httpMethod = "POST"
      request.setValue("Bearer " + item.key, forHTTPHeaderField: "Authorization")
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
      request.httpBody = try? JSONSerialization.data(withJSONObject: ["source_url": url.absoluteString,
        "capture_source": "ios_share_extension", "capture_platform": "ios"])
      transport = try? await withThrowingTaskGroup(of: (Data, URLResponse).self) { group in
        group.addTask { try await self.session.data(for: request) }
        group.addTask {
          try await Task.sleep(nanoseconds: 8_000_000_000)
          throw URLError(.timedOut)
        }
        defer { group.cancelAll() }
        return try await group.next()!
      }
    }
    let response = transport?.1 as? HTTPURLResponse
    if let (data, _) = transport, let response, (200...299).contains(response.statusCode),
      let saved = try? JSONDecoder().decode(Saved.self, from: data), !saved.id.isEmpty {
      // The recovery row is durable before transport. A crash during cleanup safely replays it.
      do { try lease.remove(ids: [entry.id]) } catch { return .queued }
      return saved.alreadySaved ? .alreadySaved : .saved
    }
    do {
      if response?.statusCode == 429 { try lease.deferRetry(id: entry.id, until: retryTime(response?.value(forHTTPHeaderField: "Retry-After"))) }
      if response?.statusCode == 401, let item, try keychain.read() == item { try keychain.remove() }
      return .queued
    } catch { return .notSaved }
  }
  private func retryTime(_ header: String?) -> String {
    let now = Date()
    var time = now.addingTimeInterval(60)
    if let header, let seconds = TimeInterval(header), seconds >= 0 { time = now.addingTimeInterval(seconds) }
    else if let header {
      let formatter = DateFormatter()
      formatter.locale = Locale(identifier: "en_US_POSIX")
      formatter.timeZone = TimeZone(secondsFromGMT: 0)
      formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss z"
      if let date = formatter.date(from: header) { time = date }
    }
    return ISO8601DateFormatter().string(from: time)
  }
  private struct Saved: Decodable { let id: String; let message: String; let alreadySaved: Bool }
}
