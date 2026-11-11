import XCTest
import Security

final class ShareKeychainTests: XCTestCase {
  func testExtensionReaderReadsExactSharedJSONItem() throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    let item = SharedShareKey(key: "cdsk_" + String(repeating: "a", count: 43), keyId: "fixture-key", deviceId: "fixture-device", userId: "fixture-user", apiBaseUrl: "https://fixture.invalid")
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "com.cosmicdolphin.share",
      kSecAttrAccount as String: "share-key",
      kSecAttrAccessGroup as String: group,
    ]
    SecItemDelete(query as CFDictionary)
    defer { SecItemDelete(query as CFDictionary) }
    var write = query
    write[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    write[kSecValueData as String] = try JSONEncoder().encode(item)
    XCTAssertEqual(SecItemAdd(write as CFDictionary, nil), errSecSuccess, "Fixture keychain write must succeed")
    XCTAssertEqual(try keychain.read(), item, "Extension reader must read the exact service/account JSON item")
  }
  func testNativeWriterUsesExactAccountServiceAccessibilityAndPayload() throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    let item = SharedShareKey(key: "cdsk_" + String(repeating: "b", count: 43), keyId: "native-key", deviceId: "stable-device", userId: "native-user", apiBaseUrl: "https://fixture.invalid")
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "com.cosmicdolphin.share", kSecAttrAccount as String: "share-key", kSecAttrAccessGroup as String: group]
    SecItemDelete(query as CFDictionary)
    defer { SecItemDelete(query as CFDictionary) }
    try keychain.write(item)
    var read = query
    read[kSecReturnAttributes as String] = true
    read[kSecReturnData as String] = true
    var result: CFTypeRef?
    XCTAssertEqual(SecItemCopyMatching(read as CFDictionary, &result), errSecSuccess, "App native writer must publish the exact extension-readable item")
    let attributes = try XCTUnwrap(result as? [String: Any])
    XCTAssertEqual(attributes[kSecAttrAccessible as String] as? String, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String)
    let data = try XCTUnwrap(attributes[kSecValueData as String] as? Data)
    let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: String])
    XCTAssertEqual(Set(json.keys), Set(["key", "keyId", "deviceId", "userId", "apiBaseUrl"]))
    XCTAssertEqual(try keychain.read(), item)
  }

  func testNativeRemovalClearsTheSharedCredentialIdempotently() throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    try keychain.write(SharedShareKey(key: "cdsk_" + String(repeating: "c", count: 43), keyId: "revoke-id", deviceId: "revoke-device", userId: "revoke-user", apiBaseUrl: "https://fixture.invalid"))
    try keychain.remove()
    XCTAssertNil(try keychain.read(), "Acknowledged sign-out must clear the shared item")
    try keychain.remove()
  }

  // Run Y alone to publish a fictional item for a cross-process device probe,
  // then Z alone to clean up. A normal full run always finishes with Z cleanup.
  func testYPublishTargetProbeFixture() throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    let item = SharedShareKey(key: "cdsk_" + String(repeating: "d", count: 43), keyId: "target-probe", deviceId: "test-only-device", userId: "test-only-user", apiBaseUrl: "https://fixture.invalid")
    try keychain.write(item)
    XCTAssertEqual(try keychain.read(), item)
  }
  func testZCleanupTargetProbeFixture() throws {
    let group = try XCTUnwrap(Bundle(for: Self.self).object(forInfoDictionaryKey: "SharedKeychainAccessGroup") as? String)
    let keychain = SharedKeychain(accessGroup: group)
    try keychain.remove()
    XCTAssertNil(try keychain.read())
  }

}
