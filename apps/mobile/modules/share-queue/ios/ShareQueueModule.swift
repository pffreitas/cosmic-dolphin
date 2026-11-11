import Foundation
import os
import ExpoModulesCore

public final class ShareQueueModule: Module {
  private func keychain() throws -> SharedKeychain {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String,
          !group.isEmpty, !group.contains("$(") else {
      throw NSError(domain: "ShareQueue", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing shared keychain access group"])
    }
    return SharedKeychain(accessGroup: group)
  }
  public func definition() -> ModuleDefinition {
    Name("ShareQueue")
    AsyncFunction("readPendingShares") { () -> String in
      let store = PendingShares(directory: try PendingShares.sharedDirectory())
      return String(decoding: try JSONEncoder().encode(store.snapshot()), as: UTF8.self)
    }
    AsyncFunction("removePendingShares") { (ids: [String]) in
      try PendingShares(directory: try PendingShares.sharedDirectory()).remove(ids: ids)
    }
    AsyncFunction("readShareKey") { () -> String? in
      guard let item = try self.keychain().read() else { return nil }
      return String(data: try JSONEncoder().encode(item), encoding: .utf8)
    }
    AsyncFunction("writeShareKey") { (payload: String) in
      let item = try JSONDecoder().decode(SharedShareKey.self, from: Data(payload.utf8))
      guard item.key.range(of: "^cdsk_[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil else {
        throw NSError(domain: "ShareQueue", code: 2, userInfo: [NSLocalizedDescriptionKey: "Expected save-only credential"])
      }
      // Serialize publishing/clearing credentials with an in-flight extension save.
      let lease = try PendingShares(directory: try PendingShares.sharedDirectory()).acquire()
      defer { lease.release() }
      try self.keychain().write(item)
      let readable = try self.keychain().read() == item
      Logger(subsystem: "com.cosmicdolphin.share-key", category: "native-probe").notice("App shared key readable=\(readable, privacy: .public)")
    }
    AsyncFunction("removeShareKey") {
      let lease = try PendingShares(directory: try PendingShares.sharedDirectory()).acquire()
      defer { lease.release() }
      try self.keychain().remove()
    }
    // A safe native read probe; never reports the credential itself.
    AsyncFunction("keychainProbe") { () -> [String: Any] in
      let keychain = try self.keychain()
      let item = try keychain.read()
      return ["readable": item != nil, "accessGroup": keychain.accessGroup,
        "service": SharedKeychain.service, "account": SharedKeychain.account,
        "deviceId": item?.deviceId ?? "", "userId": item?.userId ?? ""]
    }
  }
}
