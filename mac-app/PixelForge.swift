import Cocoa
import WebKit

// MARK: - Environment

// Le app GUI hanno una PATH ridotta — aggiunge i percorsi Homebrew/Node necessari.
func augmentedEnvironment() -> [String: String] {
    var env = ProcessInfo.processInfo.environment
    let extra = "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin"
    env["PATH"] = extra + ":" + (env["PATH"] ?? "/usr/bin:/bin:/usr/sbin:/sbin")
    return env
}

// MARK: - Process management

var backendProcess: Process?
var serverPort = 8000

// Trova una porta TCP libera su localhost chiedendola al sistema.
func findFreePort() -> Int {
    let fd = socket(AF_INET, SOCK_STREAM, 0)
    defer { close(fd) }
    var addr = sockaddr_in()
    addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    addr.sin_family = sa_family_t(AF_INET)
    addr.sin_port = 0
    addr.sin_addr.s_addr = inet_addr("127.0.0.1")
    var len = socklen_t(MemoryLayout<sockaddr_in>.size)
    let bound = withUnsafeMutablePointer(to: &addr) {
        $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(fd, $0, len) }
    }
    guard bound == 0 else { return 8000 }
    _ = withUnsafeMutablePointer(to: &addr) {
        $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { getsockname(fd, $0, &len) }
    }
    return Int(UInt16(bigEndian: addr.sin_port))
}

// Python, backend e frontend compilato sono dentro il bundle (Contents/Resources).
func spawnBackend() -> Bool {
    let res = Bundle.main.resourcePath ?? ""
    let python = res + "/python/bin/python3"
    guard FileManager.default.isExecutableFile(atPath: python) else { return false }

    serverPort = findFreePort()
    let p = Process()
    p.executableURL = URL(fileURLWithPath: python)
    p.arguments = ["-m", "uvicorn", "main:app", "--host", "127.0.0.1",
                   "--port", String(serverPort), "--log-level", "warning"]
    p.currentDirectoryURL = URL(fileURLWithPath: res + "/backend")
    var env = ProcessInfo.processInfo.environment
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["PYTHONNOUSERSITE"] = "1"
    p.environment = env
    do { try p.run() } catch { return false }
    backendProcess = p
    return true
}

func terminateAll() {
    backendProcess?.terminate()
}

// MARK: - Loading view controller

class LoadingViewController: NSViewController {
    private let label = NSTextField(labelWithString: "")
    private var dots = 0

    override func loadView() {
        view = NSView(frame: NSRect(x: 0, y: 0, width: 480, height: 280))
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor(red: 0.05, green: 0.07, blue: 0.10, alpha: 1).cgColor

        let title = NSTextField(labelWithString: "PixelForge")
        title.font = NSFont.systemFont(ofSize: 32, weight: .semibold)
        title.textColor = .white
        title.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(title)

        label.font = NSFont.systemFont(ofSize: 14)
        label.textColor = NSColor.secondaryLabelColor
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)

        NSLayoutConstraint.activate([
            title.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            title.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -20),
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 12),
        ])

        updateLabel()
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.updateLabel()
        }
    }

    private func updateLabel() {
        dots = (dots + 1) % 4
        label.stringValue = "Avvio in corso" + String(repeating: ".", count: dots)
    }
}

// MARK: - Main window controller

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var loadingVC: LoadingViewController!
    var pollTimer: Timer?
    var pollAttempts = 0
    let maxAttempts = 120  // 60 secondi (500ms × 120) — il primo avvio di PyTorch può essere lento
    var appURL: URL { URL(string: "http://127.0.0.1:\(serverPort)")! }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let started = spawnBackend()

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 800),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "PixelForge"
        window.minSize = NSSize(width: 900, height: 600)
        window.center()

        loadingVC = LoadingViewController()
        window.contentViewController = loadingVC
        if let screen = NSScreen.main {
            window.setFrame(screen.visibleFrame, display: false)
        }
        window.makeKeyAndOrderFront(nil)

        guard started else {
            showError("Componenti interni mancanti: reinstalla PixelForge.")
            return
        }
        // Attende che il backend sia pronto prima di caricare la UI
        pollTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.pollServer()
        }
    }

    func pollServer() {
        pollAttempts += 1
        if pollAttempts > maxAttempts {
            pollTimer?.invalidate()
            showError("Il motore di PixelForge non ha risposto in 60 secondi.")
            return
        }
        checkPort(serverPort) { [weak self] ok in
            guard let self, ok else { return }
            self.pollTimer?.invalidate()
            DispatchQueue.main.async { self.loadUI() }
        }
    }

    func checkPort(_ port: Int, completion: @escaping (Bool) -> Void) {
        let url = URL(string: "http://127.0.0.1:\(port)")!
        var req = URLRequest(url: url, timeoutInterval: 0.4)
        req.httpMethod = "HEAD"
        URLSession.shared.dataTask(with: req) { _, response, _ in
            let ok = (response as? HTTPURLResponse).map { $0.statusCode < 500 } ?? false
            completion(ok)
        }.resume()
    }

    func loadUI() {
        let config = WKWebViewConfiguration()
        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.load(URLRequest(url: self.appURL))
        window.contentView = webView
    }

    func showError(_ message: String) {
        DispatchQueue.main.async {
            let alert = NSAlert()
            alert.messageText = "PixelForge non si è avviato"
            alert.informativeText = message
            alert.alertStyle = .critical
            alert.addButton(withTitle: "Esci")
            alert.runModal()
            NSApplication.shared.terminate(nil)
        }
    }

    // Retry automatico se la navigazione fallisce (safety net)
    func webView(_ webView: WKWebView, didFailProvisionalNavigation _: WKNavigation!, withError _: Error) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            webView.load(URLRequest(url: self.appURL))
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        terminateAll()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    // Intercetta navigazioni: download nativi + link esterni → browser di sistema
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.shouldPerformDownload {
            decisionHandler(.download)
        } else if action.navigationType == .linkActivated,
                  let url = action.request.url,
                  url.host != "127.0.0.1" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }

    // Intercetta risposte con Content-Disposition: attachment
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if response.canShowMIMEType {
            decisionHandler(.allow)
        } else {
            decisionHandler(.download)
        }
    }

    // Collega il delegate download quando parte da un'azione di navigazione
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    // Collega il delegate download quando parte da una risposta
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    // MARK: - WKUIDelegate

    // Gestisce <input type="file"> — senza questo WKWebView ignora silenziosamente il click
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.allowedContentTypes = [.image, .jpeg, .png, .webP, .tiff, .bmp,
                                     .init(filenameExtension: "heic")!,
                                     .init(filenameExtension: "heif")!]
        panel.begin { result in
            completionHandler(result == .OK ? panel.urls : nil)
        }
    }

    // MARK: - WKDownloadDelegate

    // Mostra il pannello "Salva con nome" nativo di macOS
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.canCreateDirectories = true
        panel.begin { result in
            completionHandler(result == .OK ? panel.url : nil)
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        DispatchQueue.main.async {
            let alert = NSAlert()
            alert.messageText = "Download fallito"
            alert.informativeText = error.localizedDescription
            alert.alertStyle = .warning
            alert.runModal()
        }
    }
}

// MARK: - Entry point

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.activate(ignoringOtherApps: true)
app.run()
