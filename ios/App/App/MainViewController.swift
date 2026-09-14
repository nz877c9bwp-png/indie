import UIKit
import Capacitor
import WebKit

// Capacitor 기본 웹뷰는 iOS의 "화면 왼쪽 끝에서 오른쪽으로 스와이프하면 뒤로가기"
// 제스처가 꺼져 있다. CAPBridgeViewController를 그대로 쓰는 대신 이 클래스로
// 바꿔서(Main.storyboard의 customClass 참고) 웹뷰의 네이티브 뒤로/앞으로가기
// 스와이프 제스처를 켠다.
class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
    }
}
