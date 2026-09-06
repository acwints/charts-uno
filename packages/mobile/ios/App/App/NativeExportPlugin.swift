import Capacitor
import UIKit

/// Share generated charts through Files, Photos, and installed apps.
@objc(NativeExportPlugin)
public class NativeExportPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeExportPlugin"
    public let jsName = "NativeExport"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise)
    ]
    private var sharing = false

    @objc func shareFile(_ call: CAPPluginCall) {
        guard let encoded = call.getString("base64"), encoded.count <= 35_000_000,
              let data = Data(base64Encoded: encoded), data.count <= 25_000_000,
              let filename = call.getString("filename"), filename.count <= 100,
              filename.range(of: "^[A-Za-z0-9_-]+\\.(png|csv)$", options: .regularExpression) != nil else {
            call.reject("Could not prepare this chart for sharing", "INVALID_FILE")
            return
        }
        DispatchQueue.main.async {
            guard !self.sharing, let presenter = self.bridge?.viewController,
                  presenter.presentedViewController == nil else {
                call.reject("Close the current sheet and try again", "IN_PROGRESS")
                return
            }
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            let file = directory.appendingPathComponent(filename)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                try data.write(to: file, options: [.atomic, .completeFileProtection])
            } catch {
                try? FileManager.default.removeItem(at: directory)
                call.reject("Could not prepare this chart for sharing", "FILE_ERROR")
                return
            }
            let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
                popover.permittedArrowDirections = []
            }
            self.sharing = true
            sheet.completionWithItemsHandler = { [weak self] _, completed, _, error in
                self?.sharing = false
                try? FileManager.default.removeItem(at: directory)
                if error != nil {
                    call.reject("Could not share this chart. Please try again.", "SHARE_FAILED")
                } else {
                    call.resolve(["completed": completed])
                }
            }
            presenter.present(sheet, animated: true)
        }
    }
}
