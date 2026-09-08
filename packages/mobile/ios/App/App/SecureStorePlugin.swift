import Capacitor
import Security

/// Small Keychain-backed key/value store for the session token.
/// Values are readable only after first unlock and never leave the device
/// (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`).
@objc(SecureStorePlugin)
public class SecureStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SecureStorePlugin"
    public let jsName = "SecureStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise)
    ]
    private let service = "com.chartsuno.app.securestore"

    private func query(for key: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: key]
    }

    private func validKey(_ call: CAPPluginCall) -> String? {
        guard let key = call.getString("key"), (1...64).contains(key.count),
              key.range(of: "^[A-Za-z0-9._-]+$", options: .regularExpression) != nil else {
            call.reject("Invalid key", "INVALID_KEY")
            return nil
        }
        return key
    }

    @objc func get(_ call: CAPPluginCall) {
        guard let key = validKey(call) else { return }
        var q = query(for: key)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(q as CFDictionary, &item)
        if status == errSecSuccess, let data = item as? Data, let value = String(data: data, encoding: .utf8) {
            call.resolve(["value": value])
        } else if status == errSecItemNotFound {
            call.resolve(["value": NSNull()])
        } else {
            call.reject("Could not read from the Keychain", "KEYCHAIN_ERROR")
        }
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = validKey(call) else { return }
        guard let value = call.getString("value"), value.count <= 8192, let data = value.data(using: .utf8) else {
            call.reject("Invalid value", "INVALID_VALUE")
            return
        }
        SecItemDelete(query(for: key) as CFDictionary)
        var q = query(for: key)
        q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(q as CFDictionary, nil)
        status == errSecSuccess ? call.resolve() : call.reject("Could not write to the Keychain", "KEYCHAIN_ERROR")
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let key = validKey(call) else { return }
        let status = SecItemDelete(query(for: key) as CFDictionary)
        (status == errSecSuccess || status == errSecItemNotFound) ? call.resolve() : call.reject("Could not remove from the Keychain", "KEYCHAIN_ERROR")
    }
}
