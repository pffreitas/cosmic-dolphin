import XCTest
import Foundation
import Darwin
import UIKit
import CoreText
import UniformTypeIdentifiers

final class ShareHTTPFixture: URLProtocol {
  static var stall = false
  static var respond: ((URLRequest) throws -> (Int, [String: String], Data))!
  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    if Self.stall { return }
    do {
      let (status, headers, data) = try Self.respond(request)
      client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: headers)!, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: data)
      client?.urlProtocolDidFinishLoading(self)
    } catch { client?.urlProtocol(self, didFailWithError: error) }
  }
  override func stopLoading() {}
}

final class NativeShareTests: XCTestCase {
  func testValidKeySavesDirectlyUsingOnlyRestrictedCaptureFields() async throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    let key = "cdsk_" + String(repeating: "a", count: 43)
    try keychain.write(SharedShareKey(key: key, keyId: "native-save", deviceId: "fixture", userId: "fixture-owner", apiBaseUrl: "https://fixture.invalid"))
    defer { try? keychain.remove() }
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [ShareHTTPFixture.self]
    let session = URLSession(configuration: config)
    defer { session.invalidateAndCancel() }
    var requests = 0
    ShareHTTPFixture.respond = { request in
      requests += 1
      XCTAssertEqual(request.url?.absoluteString, "https://fixture.invalid/api/v1/bookmarks")
      XCTAssertEqual(request.httpMethod, "POST")
      XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer " + key)
      let stream = try XCTUnwrap(request.httpBodyStream)
      stream.open(); defer { stream.close() }
      var data = Data(); var buffer = [UInt8](repeating: 0, count: 4096)
      while stream.hasBytesAvailable { let n = stream.read(&buffer, maxLength: buffer.count); if n > 0 { data.append(buffer, count: n) } else { break } }
      let body = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: String])
      XCTAssertEqual(Set(body.keys), Set(["source_url", "capture_source", "capture_platform"]))
      XCTAssertEqual(body["source_url"], "https://example.com/native-share")
      XCTAssertEqual(body["capture_source"], "ios_share_extension")
      XCTAssertEqual(body["capture_platform"], "ios")
      return (201, [:], Data(#"{"id":"bookmark-1","message":"Saved","alreadySaved":false}"#.utf8))
    }
    let result = await ShareCapture(keychain: keychain, session: session).save(url: URL(string: "https://example.com/native-share"))
    XCTAssertEqual(result, .saved, "A valid restricted key must save without host-app transport")
    XCTAssertEqual(requests, 1)
  }
  func testRevokedAndOfflinePersistOriginalOwnerBeforeClearingKey() async throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory); try? keychain.remove() }
    let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [ShareHTTPFixture.self]
    let session = URLSession(configuration: config); defer { session.invalidateAndCancel() }
    for status in [401, 503] {
      try keychain.write(SharedShareKey(key: "cdsk_" + String(repeating: "b", count: 43), keyId: "rejected", deviceId: "fixture", userId: "original-owner", apiBaseUrl: "https://fixture.invalid"))
      ShareHTTPFixture.respond = { _ in (status, [:], Data()) }
      let result = await ShareCapture(keychain: keychain, session: session, directory: directory).save(url: URL(string: "https://example.com/failure-\(status)"))
      XCTAssertEqual(result, .queued, "Failure must acknowledge durable phone persistence")
      let data = try Data(contentsOf: directory.appendingPathComponent("pending-shares-v1.json"))
      let entries = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [[String: String]])
      let entry = try XCTUnwrap(entries.last)
      XCTAssertEqual(entry["userId"], "original-owner")
      XCTAssertNotNil(UUID(uuidString: entry["id"] ?? ""))
      XCTAssertNotNil(ISO8601DateFormatter().date(from: entry["queuedAt"] ?? ""))
      XCTAssertEqual(entry["url"], "https://example.com/failure-\(status)")
      XCTAssertNil(entry["notBefore"])
      if status == 401 { XCTAssertNil(try keychain.read(), "Rejected key clears only after its owning user is durable") }
    }
  }

  func testMissingKeyAndOfflineBothQueueWithoutLosingURL() async throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    try keychain.remove()
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory); try? keychain.remove() }
    let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [ShareHTTPFixture.self]
    let session = URLSession(configuration: config); defer { session.invalidateAndCancel() }
    var calls = 0
    ShareHTTPFixture.respond = { _ in calls += 1; throw URLError(.notConnectedToInternet) }
    let capture = ShareCapture(keychain: keychain, session: session, directory: directory)
    let missing = await capture.save(url: URL(string: "https://example.com/missing"))
    XCTAssertEqual(missing, .queued)
    XCTAssertEqual(calls, 0, "Missing key cannot send an unauthenticated request")
    XCTAssertEqual(try PendingShares(directory: directory).snapshot().first?.url, "https://example.com/missing")
    try keychain.write(SharedShareKey(key: "cdsk_" + String(repeating: "b", count: 43), keyId: "offline", deviceId: "fixture", userId: "offline-owner", apiBaseUrl: "https://fixture.invalid"))
    let offline = await capture.save(url: URL(string: "https://example.com/offline"))
    XCTAssertEqual(offline, .queued)
    XCTAssertEqual(try PendingShares(directory: directory).snapshot().last?.userId, "offline-owner")
    XCTAssertEqual(calls, 1)
  }

  func testRateLimitPersistsRetryAfterSecondsAndHTTPDate() async throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory); try? keychain.remove() }
    let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [ShareHTTPFixture.self]
    let session = URLSession(configuration: config); defer { session.invalidateAndCancel() }
    try keychain.write(SharedShareKey(key: "cdsk_" + String(repeating: "b", count: 43), keyId: "limited", deviceId: "fixture", userId: "rate-owner", apiBaseUrl: "https://fixture.invalid"))
    for header in ["120", "Wed, 11 Nov 2026 23:00:00 GMT"] {
      ShareHTTPFixture.respond = { _ in (429, ["Retry-After": header], Data()) }
      let before = Date()
      let result = await ShareCapture(keychain: keychain, session: session, directory: directory).save(url: URL(string: "https://example.com/rate"))
      XCTAssertEqual(result, .queued)
      let entry = try XCTUnwrap(PendingShares(directory: directory).snapshot().last)
      let retry = try XCTUnwrap(ISO8601DateFormatter().date(from: entry.notBefore ?? ""), "429 must durably retain its retry time")
      if header == "120" { XCTAssertEqual(retry.timeIntervalSince(before), 120, accuracy: 1) }
      else { XCTAssertEqual(entry.notBefore, "2026-11-11T23:00:00Z") }
    }
  }

  func testUnresponsiveRequestQueuesAtEightSeconds() async throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory); try? keychain.remove(); ShareHTTPFixture.stall = false }
    let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [ShareHTTPFixture.self]
    let session = URLSession(configuration: config); defer { session.invalidateAndCancel() }
    try keychain.write(SharedShareKey(key: "cdsk_" + String(repeating: "b", count: 43), keyId: "timeout", deviceId: "fixture", userId: "timeout-owner", apiBaseUrl: "https://fixture.invalid"))
    ShareHTTPFixture.stall = true
    let completion = expectation(description: "Durable timeout result")
    let before = Date()
    Task {
      let result = await ShareCapture(keychain: keychain, session: session, directory: directory).save(url: URL(string: "https://example.com/timeout"))
      XCTAssertEqual(result, .queued)
      XCTAssertGreaterThanOrEqual(Date().timeIntervalSince(before), 7.8)
      completion.fulfill()
    }
    await fulfillment(of: [completion], timeout: 9)
    XCTAssertEqual(try PendingShares(directory: directory).snapshot().first?.userId, "timeout-owner")
  }

  func testQueueMutationsWaitForSeparateExclusiveFileLock() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let fd = open(directory.appendingPathComponent("pending-shares-v1.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
    XCTAssertGreaterThanOrEqual(fd, 0); XCTAssertEqual(flock(fd, LOCK_EX), 0)
    defer { flock(fd, LOCK_UN); close(fd) }
    let completed = DispatchSemaphore(value: 0)
    let entry = PendingShare(id: UUID().uuidString, url: "https://example.com/locked", userId: "owner", queuedAt: "2026-11-10T12:00:00Z", notBefore: nil)
    DispatchQueue.global().async {
      do { try PendingShares(directory: directory).append(entry) } catch { XCTFail("Append failed: \(error)") }
      completed.signal()
    }
    XCTAssertEqual(completed.wait(timeout: .now() + 0.15), .timedOut, "Queue writer must respect the separate flock lease")
    flock(fd, LOCK_UN)
    XCTAssertEqual(completed.wait(timeout: .now() + 2), .success)
    XCTAssertEqual(try PendingShares(directory: directory).snapshot(), [entry])
  }

  func testTwoHundredBoundaryNeverRequestsOrOverwritesQueuedSaves() async throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory); try? keychain.remove() }
    let store = PendingShares(directory: directory)
    for index in 0..<200 { try store.append(PendingShare(id: "id-\(index)", url: "https://example.com/\(index)", userId: "owner", queuedAt: "2026-11-10T12:00:00Z", notBefore: nil)) }
    let original = try store.snapshot()
    XCTAssertThrowsError(try store.append(PendingShare(id: "overflow", url: "https://example.com/overflow", userId: nil, queuedAt: "2026-11-10T12:00:00Z", notBefore: nil)))
    let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [ShareHTTPFixture.self]
    let session = URLSession(configuration: config); defer { session.invalidateAndCancel() }
    try keychain.write(SharedShareKey(key: "cdsk_" + String(repeating: "b", count: 43), keyId: "full", deviceId: "fixture", userId: "owner", apiBaseUrl: "https://fixture.invalid"))
    var calls = 0
    ShareHTTPFixture.respond = { _ in calls += 1; return (201, [:], Data(#"{"id":"should-not-save","message":"Saved","alreadySaved":false}"#.utf8)) }
    let result = await ShareCapture(keychain: keychain, session: session, directory: directory).save(url: URL(string: "https://example.com/full"))
    XCTAssertEqual(result, .full)
    XCTAssertEqual(calls, 0, "At the 200-entry cap even an online valid key must send no request")
    XCTAssertEqual(try store.snapshot(), original)
  }

  func testInterruptedTempFlushAndAtomicReplaceNeverLoseCommittedEntries() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let original = PendingShare(id: "original", url: "https://example.com/original", userId: "owner", queuedAt: "2026-11-10T12:00:00Z", notBefore: "2026-11-11T23:00:00Z")
    let store = PendingShares(directory: directory)
    try store.append(original)
    for phase in [PendingShares.WritePhase.written, .flushed, .replaced] {
      let incoming = PendingShare(id: UUID().uuidString, url: "https://example.com/incoming", userId: "owner", queuedAt: "2026-11-10T14:00:00Z", notBefore: nil)
      let interrupted = PendingShares(directory: directory, checkpoint: { at in if at == phase { throw POSIXError(.EIO) } })
      XCTAssertThrowsError(try interrupted.append(incoming), "An interrupted boundary must never acknowledge append")
      let reloaded = try PendingShares(directory: directory).snapshot()
      XCTAssertEqual(reloaded.first, original)
      if phase != .replaced { XCTAssertFalse(reloaded.contains(incoming), "Temp-file interruption leaves the committed JSON untouched") }
      else { XCTAssertTrue(reloaded.contains(incoming), "Crash after atomic replace may replay the durable entry") }
      XCTAssertFalse(try FileManager.default.contentsOfDirectory(atPath: directory.path).contains(where: { $0.hasSuffix(".tmp") }))
    }
  }

  func testSnapshotRemovalAfterImportPreservesConcurrentArrivalAcrossCrashes() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = PendingShares(directory: directory)
    let imported = PendingShare(id: "imported", url: "https://example.com/imported", userId: "owner", queuedAt: "2026-11-10T12:00:00Z", notBefore: "2026-11-11T23:00:00Z")
    let arrival = PendingShare(id: "concurrent", url: "https://example.com/concurrent", userId: "owner", queuedAt: "2026-11-10T13:00:00Z", notBefore: nil)
    try store.append(imported)
    let snapshot = try store.snapshot()
    // Native storage-boundary fixture. Jest separately exercises actual AsyncStorage import.
    let appFile = directory.appendingPathComponent("durable-app-import.json")
    try JSONEncoder().encode(snapshot).write(to: appFile, options: .atomic)
    let app = try FileHandle(forWritingTo: appFile); try app.synchronize(); try app.close()
    try PendingShares(directory: directory).append(arrival)
    for phase in [PendingShares.WritePhase.written, .flushed] {
      let interrupted = PendingShares(directory: directory, checkpoint: { at in if at == phase { throw POSIXError(.EIO) } })
      XCTAssertThrowsError(try interrupted.remove(ids: snapshot.map(\.id)))
      XCTAssertEqual(try store.snapshot().map(\.id), ["imported", "concurrent"])
    }
    try store.remove(ids: snapshot.map(\.id))
    XCTAssertEqual(try store.snapshot(), [arrival], "Remove must re-read under lock and remove only imported IDs")
    XCTAssertEqual(try JSONDecoder().decode([PendingShare].self, from: Data(contentsOf: appFile)), snapshot)
    try store.remove(ids: snapshot.map(\.id))
    XCTAssertEqual(try store.snapshot(), [arrival], "Repeated cleanup after a crash cannot delete a later append")
  }

  func testPersistenceFailureNeverAcknowledgesPhoneSaveOrClearsRejectedOwner() async throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory); try? keychain.remove() }
    let item = SharedShareKey(key: "cdsk_" + String(repeating: "b", count: 43), keyId: "retain-on-write-failure", deviceId: "fixture", userId: "original-owner", apiBaseUrl: "https://fixture.invalid")
    try keychain.write(item)
    let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [ShareHTTPFixture.self]
    let session = URLSession(configuration: config); defer { session.invalidateAndCancel() }
    ShareHTTPFixture.respond = { _ in (401, [:], Data()) }
    let interrupted = PendingShares(directory: directory, checkpoint: { at in if at == .flushed { throw POSIXError(.EIO) } })
    let result = await ShareCapture(keychain: keychain, session: session, directory: directory, pending: interrupted).save(url: URL(string: "https://example.com/persist-failure"))
    XCTAssertEqual(result, .notSaved, "Only a committed queue write may announce Saved on this phone")
    XCTAssertEqual(try keychain.read(), item, "Retain the owning credential until its failed share is durable")
    XCTAssertTrue(try PendingShares(directory: directory).snapshot().isEmpty)
  }

  func testNonHTTPInputNeverRequestsOrConsumesQueueCapacity() async throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory); try? keychain.remove() }
    try keychain.write(SharedShareKey(key: "cdsk_" + String(repeating: "b", count: 43), keyId: "no-url", deviceId: "fixture", userId: "owner", apiBaseUrl: "https://fixture.invalid"))
    let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [ShareHTTPFixture.self]
    let session = URLSession(configuration: config); defer { session.invalidateAndCancel() }
    var calls = 0
    ShareHTTPFixture.respond = { _ in calls += 1; return (201, [:], Data(#"{"id":"should-not-save","message":"Saved","alreadySaved":false}"#.utf8)) }
    let capture = ShareCapture(keychain: keychain, session: session, directory: directory)
    for url in [nil, URL(string: "file:///tmp/private.pdf"), URL(string: "ftp://example.com/file"), URL(string: "https:/incomplete")] {
      let result = await capture.save(url: url)
      XCTAssertEqual(result, .noURL)
    }
    XCTAssertEqual(calls, 0)
    XCTAssertTrue(try PendingShares(directory: directory).snapshot().isEmpty)
  }

  func testRequestStartsWithDurableRecoveryRowAndSuccessRemovesOnlyItsOwnID() async throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory); try? keychain.remove() }
    let original = PendingShare(id: "waiting", url: "https://example.com/waiting", userId: "other", queuedAt: "2026-11-09T12:00:00Z", notBefore: nil)
    let store = PendingShares(directory: directory); try store.append(original)
    try keychain.write(SharedShareKey(key: "cdsk_" + String(repeating: "b", count: 43), keyId: "durable-first", deviceId: "fixture", userId: "owner", apiBaseUrl: "https://fixture.invalid"))
    let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [ShareHTTPFixture.self]
    let session = URLSession(configuration: config); defer { session.invalidateAndCancel() }
    ShareHTTPFixture.respond = { _ in
      let rows = try JSONDecoder().decode([PendingShare].self, from: Data(contentsOf: directory.appendingPathComponent(PendingShares.filename)))
      XCTAssertEqual(rows.count, 2, "A crash during transport must leave a recoverable stable ID")
      XCTAssertEqual(rows.last?.userId, "owner")
      XCTAssertEqual(rows.last?.url, "https://example.com/durable-first")
      return (201, [:], Data(#"{"id":"saved","message":"Saved","alreadySaved":false}"#.utf8))
    }
    let result = await ShareCapture(keychain: keychain, session: session, directory: directory).save(url: URL(string: "https://example.com/durable-first"))
    XCTAssertEqual(result, .saved)
    XCTAssertEqual(try store.snapshot(), [original], "Only the acknowledged native save ID can be removed")
  }

  @MainActor
  func testNativePanelSavesOnOpenAndVoiceOverKeepsResultAndClose() async throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory); try? keychain.remove() }
    try keychain.write(SharedShareKey(key: "cdsk_" + String(repeating: "b", count: 43), keyId: "panel", deviceId: "fixture", userId: "owner", apiBaseUrl: "https://fixture.invalid"))
    let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [ShareHTTPFixture.self]
    let session = URLSession(configuration: config); defer { session.invalidateAndCancel() }
    var requests = 0
    ShareHTTPFixture.respond = { _ in requests += 1; return (201, [:], Data(#"{"id":"saved","message":"Saved","alreadySaved":false}"#.utf8)) }
    let controller = ShareViewController()
    controller.capture = ShareCapture(keychain: keychain, session: session, directory: directory)
    controller.voiceOverEnabled = { true }
    var completions = 0; controller.complete = { completions += 1 }
    controller.loadViewIfNeeded()
    let item = NSExtensionItem()
    item.attributedTitle = NSAttributedString(string: "A readable native share")
    item.attachments = [NSItemProvider(item: URL(string: "https://example.com/panel")! as NSURL, typeIdentifier: UTType.url.identifier)]
    await controller.start(items: [item])
    func find(_ view: UIView, _ id: String) -> UIView? {
      if view.accessibilityIdentifier == id { return view }
      for child in view.subviews { if let match = find(child, id) { return match } }
      return nil
    }
    let status = try XCTUnwrap(find(controller.view, "share-status") as? UILabel)
    XCTAssertEqual(status.text, "Saved to Cosmic Dolphin")
    XCTAssertTrue(status.isAccessibilityElement)
    XCTAssertEqual(requests, 1)
    try await Task.sleep(nanoseconds: 1_700_000_000)
    XCTAssertEqual(completions, 0, "VoiceOver must retain the result instead of auto-closing")
    let close = try XCTUnwrap(find(controller.view, "share-close") as? UIButton)
    XCTAssertEqual(close.accessibilityLabel, "Close")
    close.sendActions(for: .touchUpInside)
    XCTAssertEqual(completions, 1, "Close completes only the extension context")
  }

  func testConcurrentWritersAndSnapshotRemovalLoseNoOtherIDs() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let group = DispatchGroup()
    for index in 0..<100 {
      group.enter()
      DispatchQueue.global().async {
        defer { group.leave() }
        do { try PendingShares(directory: directory).append(PendingShare(id: "concurrent-\(index)", url: "https://example.com/\(index)", userId: "owner", queuedAt: "2026-11-10T12:00:00Z", notBefore: "2026-11-11T23:00:00Z")) }
        catch { XCTFail("Concurrent append failed: \(error)") }
      }
    }
    XCTAssertEqual(group.wait(timeout: .now() + 10), .success)
    let store = PendingShares(directory: directory)
    let snapshot = try store.snapshot()
    XCTAssertEqual(Set(snapshot.map(\.id)), Set((0..<100).map { "concurrent-\($0)" }))
    XCTAssertTrue(snapshot.allSatisfy { $0.queuedAt == "2026-11-10T12:00:00Z" && $0.notBefore == "2026-11-11T23:00:00Z" })
    let removing = Set(snapshot.prefix(50).map(\.id))
    for index in 100..<150 {
      group.enter()
      DispatchQueue.global().async {
        defer { group.leave() }
        do { try PendingShares(directory: directory).append(PendingShare(id: "concurrent-\(index)", url: "https://example.com/\(index)", userId: "owner", queuedAt: "2026-11-10T12:00:00Z", notBefore: nil)) }
        catch { XCTFail("Concurrent arrival failed: \(error)") }
      }
    }
    try store.remove(ids: Array(removing))
    XCTAssertEqual(group.wait(timeout: .now() + 10), .success)
    XCTAssertEqual(Set(try store.snapshot().map(\.id)), Set((0..<150).map { "concurrent-\($0)" }).subtracting(removing))
  }

  @MainActor
  func testReduceMotionKeepsAStationaryLoadingIndicator() throws {
    let controller = ShareViewController()
    controller.reduceMotionEnabled = { true }
    controller.loadViewIfNeeded()
    func find(_ view: UIView, _ id: String) -> UIView? {
      if view.accessibilityIdentifier == id { return view }
      for child in view.subviews { if let match = find(child, id) { return match } }
      return nil
    }
    let rotating = try XCTUnwrap(find(controller.view, "share-progress") as? UIActivityIndicatorView)
    XCTAssertFalse(rotating.isAnimating, "Reduce Motion disables spinner rotation")
    let stationary = try XCTUnwrap(find(controller.view, "share-progress-static") as? UIImageView, "Keep the specified static loading ring under Reduce Motion")
    XCTAssertFalse(stationary.isHidden)
    XCTAssertEqual(stationary.alpha, 0.6, accuracy: 0.000001)
    XCTAssertNil(stationary.layer.animationKeys())
  }

  @MainActor
  func testNativeResultStatesHaveAccessibleCopyAndErrorsStayOpen() async throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [ShareHTTPFixture.self]
    let session = URLSession(configuration: config); defer { session.invalidateAndCancel(); try? keychain.remove() }
    for (state, expected) in [("duplicate", "Already in your Library"), ("missing", "Saved on this phone. Cosmic reads it when you open the app."), ("no-url", "Cosmic Dolphin can only save links"), ("full", "Open Cosmic Dolphin to finish saving")] {
      let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      defer { try? FileManager.default.removeItem(at: directory) }
      if state == "full" {
        for index in 0..<200 { try PendingShares(directory: directory).append(PendingShare(id: "\(index)", url: "https://example.com/\(index)", userId: nil, queuedAt: "2026-11-10T12:00:00Z", notBefore: nil)) }
      }
      try keychain.remove()
      if state == "duplicate" { try keychain.write(SharedShareKey(key: "cdsk_" + String(repeating: "b", count: 43), keyId: "duplicate", deviceId: "fixture", userId: "owner", apiBaseUrl: "https://fixture.invalid")) }
      ShareHTTPFixture.respond = { _ in (200, [:], Data(#"{"id":"duplicate","message":"Already in your Library","alreadySaved":true}"#.utf8)) }
      let controller = ShareViewController()
      controller.capture = ShareCapture(keychain: keychain, session: session, directory: directory)
      controller.voiceOverEnabled = { true }
      var closed = false; controller.complete = { closed = true }
      controller.loadViewIfNeeded()
      let item = NSExtensionItem(); item.attributedTitle = NSAttributedString(string: "Native title")
      item.attachments = [NSItemProvider(item: URL(string: "https://example.com/result")! as NSURL, typeIdentifier: UTType.url.identifier)]
      await controller.start(items: state == "no-url" ? [] : [item])
      func find(_ view: UIView, _ id: String) -> UIView? {
        if view.accessibilityIdentifier == id { return view }
        for child in view.subviews { if let match = find(child, id) { return match } }
        return nil
      }
      let status = try XCTUnwrap(find(controller.view, "share-status") as? UILabel)
      XCTAssertEqual(status.text, expected)
      XCTAssertTrue(status.isAccessibilityElement)
      XCTAssertEqual(status.numberOfLines, 0)
      XCTAssertFalse(closed)
      let close = try XCTUnwrap(find(controller.view, "share-close") as? UIButton)
      XCTAssertTrue(close.isEnabled)
      XCTAssertEqual(close.accessibilityLabel, "Close")
      close.sendActions(for: .touchUpInside)
      XCTAssertTrue(closed)
    }
  }

  func testLocalAPIRestrictedTransportCreatesOneBookmarkWithIOSAttribution() async throws {
    let (fixtureData, _) = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:5536/fixture")!)
    let fixture = try XCTUnwrap(JSONSerialization.jsonObject(with: fixtureData) as? [String: Any])
    let item = try JSONDecoder().decode(SharedShareKey.self, from: JSONSerialization.data(withJSONObject: fixture["item"]!))
    let article = try XCTUnwrap(fixture["article"] as? String)
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group); try keychain.write(item)
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory); try? keychain.remove() }
    let capture = ShareCapture(keychain: keychain, directory: directory)
    let first = await capture.save(url: URL(string: article))
    XCTAssertTrue([.saved, .alreadySaved].contains(first))
    let duplicate = await capture.save(url: URL(string: article))
    XCTAssertEqual(duplicate, .alreadySaved)
    let (stateData, _) = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:5536/fixture/state")!)
    let state = try XCTUnwrap(JSONSerialization.jsonObject(with: stateData) as? [String: Any])
    let rows = try XCTUnwrap(state["rows"] as? [[String: Any]])
    XCTAssertEqual(rows.filter { $0["source_url"] as? String == article }.count, 1)
    let row = try XCTUnwrap(rows.first { $0["source_url"] as? String == article })
    XCTAssertEqual(row["capture_source"] as? String, "ios_share_extension")
    XCTAssertEqual(row["capture_platform"] as? String, "ios")
    XCTAssertEqual((state["jobCounts"] as? [String: Int])?[row["id"] as! String], 1)
    XCTAssertTrue(try PendingShares(directory: directory).snapshot().isEmpty)
  }

  // Test-only publication for an actual Safari extension / foreground bridge probe.
  // Full scheme runs finish with ShareKeychainTests' existing Z cleanup.
  func testYPublishLocalTransportFixture() async throws {
    let (data, _) = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:5536/fixture")!)
    let fixture = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    let item = try JSONDecoder().decode(SharedShareKey.self, from: JSONSerialization.data(withJSONObject: fixture["item"]!))
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    try SharedKeychain(accessGroup: group).write(item)
  }
  func testYPublishOfflineTransportFixture() async throws {
    let (data, _) = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:5536/fixture?offline=1")!)
    let fixture = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    let item = try JSONDecoder().decode(SharedShareKey.self, from: JSONSerialization.data(withJSONObject: fixture["item"]!))
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    try SharedKeychain(accessGroup: group).write(item)
  }

  func testLocalAPIRevocationQueuesThenOwnerReplayCreatesExactlyOne() async throws {
    let (data, _) = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:5536/fixture/revoked")!)
    let fixture = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    let item = try JSONDecoder().decode(SharedShareKey.self, from: JSONSerialization.data(withJSONObject: fixture["item"]!))
    let article = try XCTUnwrap(fixture["article"] as? String)
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group); try keychain.write(item)
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory); try? keychain.remove() }
    let result = await ShareCapture(keychain: keychain, directory: directory).save(url: URL(string: article))
    XCTAssertEqual(result, .queued)
    let row = try XCTUnwrap(PendingShares(directory: directory).snapshot().first)
    XCTAssertEqual(row.userId, item.userId)
    XCTAssertNil(try keychain.read())
    // Explicit fixture-owner auth boundary. This is transport/API proof, not a real host session.
    var replay = URLRequest(url: URL(string: item.apiBaseUrl + "/api/v1/bookmarks")!)
    replay.httpMethod = "POST"; replay.setValue("Bearer fixture-owner", forHTTPHeaderField: "Authorization")
    replay.setValue("application/json", forHTTPHeaderField: "Content-Type")
    replay.httpBody = try JSONSerialization.data(withJSONObject: ["source_url": row.url, "capture_source": "ios_share_extension", "capture_platform": "ios", "queued_at": row.queuedAt])
    for _ in 0..<2 {
      let (_, response) = try await URLSession.shared.data(for: replay)
      XCTAssertTrue([200, 201].contains((response as! HTTPURLResponse).statusCode))
    }
    let (stateData, _) = try await URLSession.shared.data(from: URL(string: "http://127.0.0.1:5536/fixture/state")!)
    let state = try XCTUnwrap(JSONSerialization.jsonObject(with: stateData) as? [String: Any])
    let rows = try XCTUnwrap(state["rows"] as? [[String: Any]])
    XCTAssertEqual(rows.filter { $0["source_url"] as? String == article }.count, 1)
    let saved = try XCTUnwrap(rows.first { $0["source_url"] as? String == article })
    XCTAssertEqual(saved["capture_source"] as? String, "ios_share_extension")
    XCTAssertEqual(saved["capture_platform"] as? String, "ios")
    let timestamp = try XCTUnwrap(saved["capture_queued_at"] as? String)
    XCTAssertTrue(timestamp.hasPrefix(String(row.queuedAt.dropLast())), "Owner replay must preserve the original capture time")
  }

  @MainActor
  func testQueuedResultAutoCompletesOnlyExtensionWhenVoiceOverIsOff() async throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group); try keychain.remove()
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let controller = ShareViewController()
    controller.capture = ShareCapture(keychain: keychain, directory: directory)
    controller.voiceOverEnabled = { false }
    var completions = 0; controller.complete = { completions += 1 }
    controller.loadViewIfNeeded()
    let item = NSExtensionItem()
    item.attachments = [NSItemProvider(item: URL(string: "https://example.com/auto-close")! as NSURL, typeIdentifier: UTType.url.identifier)]
    await controller.start(items: [item])
    XCTAssertEqual(completions, 0, "The result must be shown before normal completion")
    XCTAssertEqual(try PendingShares(directory: directory).snapshot().count, 1)
    try await Task.sleep(nanoseconds: 1_700_000_000)
    XCTAssertEqual(completions, 1)
  }

  func testMobilePlumColorsResolveInBothAppearances() {
    for (style, expected) in [(UIUserInterfaceStyle.light, (90.0, 41.0, 80.0)), (.dark, (227.0, 185.0, 218.0))] {
      let traits = UITraitCollection(userInterfaceStyle: style)
      for name in ["accent", "focus"] {
        let color = ShareTheme.color(name).resolvedColor(with: traits)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        XCTAssertTrue(color.getRed(&r, green: &g, blue: &b, alpha: &a))
        XCTAssertEqual(r, expected.0 / 255, accuracy: 0.001)
        XCTAssertEqual(g, expected.1 / 255, accuracy: 0.001)
        XCTAssertEqual(b, expected.2 / 255, accuracy: 0.001)
      }
    }
  }

  func testTitleUsesCanonicalSemiboldFontResource() throws {
    let bundle = Bundle(for: ShareViewController.self)
    let resource = try XCTUnwrap(bundle.url(forResource: "SourceSerif4-600", withExtension: "ttf"))
    let descriptors = try XCTUnwrap(CTFontManagerCreateFontDescriptorsFromURL(resource as CFURL) as? [CTFontDescriptor])
    let expected = CTFontDescriptorCopyAttribute(descriptors[0], kCTFontNameAttribute) as? String
    XCTAssertEqual(ShareTheme.font("title-1", style: .title1).fontName, expected)
  }

  @MainActor
  func testAX3CloseCapsAndContentRemainsUncapped() throws {
    let controller = ShareViewController()
    controller.loadViewIfNeeded()
    func descendants(_ view: UIView) -> [UIView] { view.subviews.flatMap { [$0] + descendants($0) } }
    let views = descendants(controller.view)
    let close = try XCTUnwrap(views.first { $0.accessibilityIdentifier == "share-close" } as? UIButton)
    let status = try XCTUnwrap(views.first { $0.accessibilityIdentifier == "share-status" } as? UILabel)
    XCTAssertLessThanOrEqual(try XCTUnwrap(close.titleLabel?.font.pointSize), 13.5 * 1.3 + 0.01)
    // UIFontMetrics' default uses the system preference, not performAsCurrent.
    // Explicit traits keep this policy fixture independent of simulator settings;
    // the actual controller was also inspected at the global AX3 setting.
    let traits = UITraitCollection(preferredContentSizeCategory: .accessibilityExtraLarge)
    XCTAssertLessThanOrEqual(ShareTheme.font("body-sm", maximumScale: 1.3, compatibleWith: traits).pointSize, 13.5 * 1.3 + 0.01)
    XCTAssertGreaterThan(ShareTheme.font("body-sm", compatibleWith: traits).pointSize, 14 * 1.3)
    XCTAssertEqual(status.numberOfLines, 0)
    XCTAssertEqual(close.titleLabel?.numberOfLines, 0)
  }

}
