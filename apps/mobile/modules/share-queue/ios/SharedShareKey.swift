import Foundation
import Security

struct SharedShareKey: Codable, Equatable {
  let key: String
  let keyId: String
  let deviceId: String
  let userId: String
  let apiBaseUrl: String
}

struct SharedKeychain {
  static let service = "com.cosmicdolphin.share"
  static let account = "share-key"
  let accessGroup: String
  private var query: [String: Any] {
    [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: Self.service,
     kSecAttrAccount as String: Self.account, kSecAttrAccessGroup as String: accessGroup]
  }
  func write(_ item: SharedShareKey) throws {
    let attributes: [String: Any] = [kSecValueData as String: try JSONEncoder().encode(item),
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
    let updated = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    if updated == errSecItemNotFound {
      let status = SecItemAdd(query.merging(attributes) { _, value in value } as CFDictionary, nil)
      guard status == errSecSuccess else { throw error(status) }
    } else if updated != errSecSuccess { throw error(updated) }
  }
  func remove() throws {
    let status = SecItemDelete(query as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else { throw error(status) }
  }
  func read() throws -> SharedShareKey? {
    var read = query
    read[kSecReturnData as String] = true
    read[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(read as CFDictionary, &result)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = result as? Data else { throw error(status) }
    return try JSONDecoder().decode(SharedShareKey.self, from: data)
  }
  private func error(_ status: OSStatus) -> NSError {
    NSError(domain: NSOSStatusErrorDomain, code: Int(status), userInfo: nil)
  }
}
