import AuthenticationServices
import Capacitor

/// An OS-owned authentication sheet returns to the existing WKWebView.
/// It never navigates the app's webview or shares its session cookie with Safari.
@objc(NativeAuthPlugin)
public class NativeAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "NativeAuthPlugin"
    public let jsName = "NativeAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise)
    ]
    private var session: ASWebAuthenticationSession?

    @objc func authenticate(_ call: CAPPluginCall) {
        guard let rawURL = call.getString("url"), let url = URL(string: rawURL),
              url.scheme == "https", url.host == "accounts.google.com" else {
            call.reject("Invalid authentication URL", "INVALID_URL")
            return
        }
        DispatchQueue.main.async {
            guard self.session == nil else {
                call.reject("Sign-in is already open", "IN_PROGRESS")
                return
            }
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "com.chartsuno.app") { [weak self] callback, error in
                self?.session = nil
                if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    call.reject("Sign-in cancelled", "CANCELLED")
                } else if let callback = callback, callback.scheme == "com.chartsuno.app", callback.host == "auth-callback" {
                    call.resolve(["url": callback.absoluteString])
                } else {
                    call.reject("Could not finish sign-in. Please try again.", "AUTH_FAILED")
                }
            }
            session.presentationContextProvider = self
            self.session = session
            if !session.start() {
                self.session = nil
                call.reject("Could not open sign-in. Please try again.", "AUTH_FAILED")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}

class ChartsunoViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        // Capacitor paints a single hex behind the webview; use the launch
        // colour instead so the frame between launch screen and splash view
        // matches the current appearance (white in light, #101014 in dark).
        let ground = UIColor(named: "LaunchBackground") ?? UIColor(red: 0.063, green: 0.063, blue: 0.078, alpha: 1)
        view.backgroundColor = ground
        webView?.isOpaque = false
        webView?.backgroundColor = ground
        webView?.scrollView.backgroundColor = ground
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // StatusBar resets to launch config in super; restore the web theme.
        bridge?.triggerJSEvent(eventName: "chartsunoViewDidAppear", target: "window")
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAuthPlugin())
        bridge?.registerPluginInstance(NativeExportPlugin())
        bridge?.registerPluginInstance(SecureStorePlugin())
        webView?.allowsBackForwardNavigationGestures = true
    }
}
