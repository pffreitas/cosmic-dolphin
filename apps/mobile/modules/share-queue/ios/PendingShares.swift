import Foundation
import Darwin

struct PendingShare: Codable, Equatable {
  let id: String
  let url: String
  let userId: String?
  let queuedAt: String
  var notBefore: String?
}

final class PendingShares {
  static let group = "group.com.cosmicdolphin.app"
  enum QueueError: Error { case full }
  static let limit = 200
  static let filename = "pending-shares-v1.json"
  enum WritePhase { case written, flushed, replaced }
  let directory: URL
  let checkpoint: ((WritePhase) throws -> Void)?
  init(directory: URL, checkpoint: ((WritePhase) throws -> Void)? = nil) {
    self.directory = directory
    self.checkpoint = checkpoint
  }
  static func sharedDirectory() throws -> URL {
    guard let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
      throw NSError(domain: "ShareQueue", code: 1, userInfo: nil)
    }
    return directory
  }
  // The inode of this file never changes when the JSON queue is replaced.
  func acquire() throws -> Lease {
    let fd = open(directory.appendingPathComponent("pending-shares-v1.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
    guard fd >= 0 else { throw POSIXError(.EIO) }
    do { try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: directory.appendingPathComponent("pending-shares-v1.lock").path) }
    catch { close(fd); throw error }
    guard flock(fd, LOCK_EX) == 0 else { close(fd); throw POSIXError(.EIO) }
    return Lease(store: self, fd: fd)
  }
  final class Lease {
    private let store: PendingShares
    private var fd: Int32
    fileprivate init(store: PendingShares, fd: Int32) { self.store = store; self.fd = fd }
    func release() { if fd >= 0 { flock(fd, LOCK_UN); close(fd); fd = -1 } }
    deinit { release() }
    func snapshot() throws -> [PendingShare] {
      guard fd >= 0 else { throw POSIXError(.EBADF) }
      return try store.readUnlocked()
    }
    func deferRetry(id: String, until: String) throws {
      var entries = try snapshot()
      guard let index = entries.firstIndex(where: { $0.id == id }) else { throw POSIXError(.ENOENT) }
      entries[index].notBefore = until
      try store.replace(entries)
    }
    func remove(ids: [String]) throws {
      let ids = Set(ids)
      let entries = try snapshot()
      let kept = entries.filter { !ids.contains($0.id) }
      if kept.count != entries.count { try store.replace(kept) }
    }
    func append(_ entry: PendingShare) throws {
      let entries = try snapshot()
      guard entries.count < PendingShares.limit else { throw QueueError.full }
      try store.replace(entries + [entry])
    }
  }
  func snapshot() throws -> [PendingShare] {
    let lease = try acquire(); defer { lease.release() }
    return try lease.snapshot()
  }
  private func readUnlocked() throws -> [PendingShare] {
    let file = directory.appendingPathComponent(Self.filename)
    if !FileManager.default.fileExists(atPath: file.path) { return [] }
    return try JSONDecoder().decode([PendingShare].self, from: Data(contentsOf: file))
  }
  func append(_ entry: PendingShare) throws {
    let lease = try acquire(); defer { lease.release() }
    try lease.append(entry)
  }
  func remove(ids: [String]) throws {
    let lease = try acquire(); defer { lease.release() }
    try lease.remove(ids: ids)
  }
  private func replace(_ entries: [PendingShare]) throws {
    let temporary = directory.appendingPathComponent(".pending-shares-" + UUID().uuidString + ".tmp")
    defer { try? FileManager.default.removeItem(at: temporary) }
    let data = try JSONEncoder().encode(entries)
    try data.write(to: temporary, options: .completeFileProtectionUntilFirstUserAuthentication)
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: temporary.path)
    try checkpoint?(.written)
    let handle = try FileHandle(forWritingTo: temporary)
    defer { try? handle.close() }
    try handle.synchronize()
    try checkpoint?(.flushed)
    let destination = directory.appendingPathComponent(Self.filename)
    guard rename(temporary.path, destination.path) == 0 else { throw POSIXError(.EIO) }
    try checkpoint?(.replaced)
    let fd = open(directory.path, O_RDONLY)
    guard fd >= 0 else { throw POSIXError(.EIO) }
    defer { close(fd) }
    guard fsync(fd) == 0 else { throw POSIXError(.EIO) }
  }
}
