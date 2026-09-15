import UIKit
import Capacitor
import WebKit

// Capacitor 기본 웹뷰는 iOS의 "화면 왼쪽 끝에서 오른쪽으로 스와이프하면 뒤로가기"
// 제스처가 꺼져 있다. CAPBridgeViewController를 그대로 쓰는 대신 이 클래스로
// 바꿔서(Main.storyboard의 customClass 참고) 웹뷰의 네이티브 뒤로/앞으로가기
// 스와이프 제스처를 켠다.
class MainViewController: CAPBridgeViewController {
    private var navigationProxy: NavigationDelegateProxy?

    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let webView = webView, let inner = webView.navigationDelegate else { return }
        navigationProxy = NavigationDelegateProxy(inner: inner)
        webView.navigationDelegate = navigationProxy
    }
}

// Capacitor는 로드가 실패하면 이유를 안 가리고 errorPath(오프라인 안내)를 띄운다. 그런데 외부 링크를
// Safari로 넘기며 웹뷰 이동을 취소할 때(WebKit 102 "Frame load interrupted")나 리다이렉트 중 앞선
// 이동이 뒤 이동에 밀려 취소될 때(NSURLErrorCancelled -999)도 똑같이 띄워서, 게시판 링크를 누르거나
// Apple/카카오 로그인 중에 앱이 오프라인 안내로 덮여 버렸다. 이 두 오류는 무시하고 나머지만 원래
// 처리(오프라인 안내)로 넘긴다. Capacitor가 핸들러를 private으로 만들어서 델리게이트를 감싸는 방식.
private class NavigationDelegateProxy: NSObject, WKNavigationDelegate {
    private let inner: WKNavigationDelegate

    init(inner: WKNavigationDelegate) {
        self.inner = inner
    }

    private func isBenign(_ error: Error) -> Bool {
        let e = error as NSError
        return (e.domain == NSURLErrorDomain && e.code == NSURLErrorCancelled)
            || (e.domain == "WebKitErrorDomain" && e.code == 102)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if isBenign(error) { return }
        inner.webView?(webView, didFailProvisionalNavigation: navigation, withError: error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if isBenign(error) { return }
        inner.webView?(webView, didFail: navigation, withError: error)
    }

    // 위 두 메서드 외의 모든 WKNavigationDelegate 호출은 Capacitor 핸들러로 그대로 넘긴다.
    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || inner.responds(to: aSelector)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        inner.responds(to: aSelector) ? inner : super.forwardingTarget(for: aSelector)
    }
}
