import AuthenticationServices
import Capacitor

/// An OS-owned authentication sheet returns to the existing WKWebView.
/// It never navigates the app's webview or shares its session cookie with Safari.
@objc(NativeAuthPlugin)
public class NativeAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "NativeAuthPlugin"
    public let jsName = "NativeAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signInWithApple", returnType: CAPPluginReturnPromise)
    ]
    private var session: ASWebAuthenticationSession?
    private var appleCall: CAPPluginCall?
    private var appleController: ASAuthorizationController?

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

    /// Native Sign in with Apple. The identity token is verified by the API;
    /// the app never embeds Google or Apple inside the WKWebView.
    @objc func signInWithApple(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.appleCall == nil else {
                call.reject("Sign-in is already open", "IN_PROGRESS")
                return
            }
            self.appleCall = call
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.appleController = controller
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        defer {
            appleCall = nil
            appleController = nil
        }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8) else {
            appleCall?.reject("Could not finish sign-in. Please try again.", "AUTH_FAILED")
            return
        }
        var result: [String: Any] = [
            "identityToken": identityToken,
            "user": credential.user,
        ]
        if let email = credential.email, !email.isEmpty {
            result["email"] = email
        }
        if let name = credential.fullName {
            let formatted = PersonNameComponentsFormatter().string(from: name).trimmingCharacters(in: .whitespacesAndNewlines)
            if !formatted.isEmpty {
                result["fullName"] = formatted
            }
        }
        appleCall?.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let nsError = error as NSError
        let cancelled = nsError.domain == ASAuthorizationError.errorDomain
            && nsError.code == ASAuthorizationError.canceled.rawValue
        appleCall?.reject(
            cancelled ? "Sign-in cancelled" : "Could not finish sign-in. Please try again.",
            cancelled ? "CANCELLED" : "AUTH_FAILED"
        )
        appleCall = nil
        appleController = nil
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
