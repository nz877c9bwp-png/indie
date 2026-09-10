## 목적

Stored XSS, 즉 “게시글에 단순 글자가 아니라 실행 가능한 HTML/JavaScript가 숨어 들어가 DB에 저장되고, 다른 사용자가 해당 화면을 볼 때 그 코드가 실행될 수 있는 문제”를 frontend에서 차단한다.

실제로 앨범 표지 URL과 앨범명이 HTML 속성·클릭 코드로 해석되는 경로를 확인했다. Supabase 서버 설정을 변경하지 않고 사용자 데이터의 화면 표시 방식을 수정했다.

## 발견한 문제

- DB의 `album_cover`가 이미지 HTML 속성에 그대로 들어가 이벤트 속성을 만들고 JavaScript를 실행했다.
- DB의 앨범명이 inline onclick에 들어가 카드 클릭 시 코드를 실행했다. URL 인코딩은 작은따옴표를 제거하지 않아 JS 문자열을 보호하지 못했다. 가수명도 같은 문맥에 들어갔다.
- 외부 앨범 검색 결과의 이름도 같은 클릭 코드 주입 문제를 보였다. 이 단계는 저장 전 DOM XSS 경로다.
- 검색 표지 URL도 raw HTML/JS 속성에 들어갔다. 본문 이미지에는 URL scheme 검증이 없었고, YouTube 변환은 이미 생성한 이미지 HTML을 다시 처리했다.

일반 게시글 title/author/tag, HOT, 리뷰 title/author에는 이미 escape 처리가 있었다. 이를 새로 재현된 취약점이라고 주장하지 않는다. `[img]`의 단순 quote 탈출도 기존 escaping으로 차단됨을 확인했다. 실제 재현 3건과 보호된 경로를 구분한 전체 분석은 `docs/security-xss-review.md`에 기록했다.

## 변경 내용

- 목록·HOT·앨범·리뷰·검색·닉네임을 `textContent`/DOM API로 렌더링한다.
- 동적 inline onclick을 `addEventListener`로 바꾸고 원래 데이터를 전달한다.
- 이미지 URL을 URL parser로 검증하고 절대 HTTPS만 허용한다. 잘못된 URL·credentials·raw quotes/공백·다른 scheme은 거부한다.
- `[img]`는 검증 후 DOM API로 img를 만들고, 잘못된 marker는 일반 글자로 표시한다.
- YouTube는 지원 host/path와 정확히 11자인 video ID를 검증해 고정 HTTPS embed URL의 iframe을 만든다.
- 본문을 한 번만 파싱하고 리뷰 preview는 HTML을 만들거나 다시 해석하지 않는다.
- 최소한의 Playwright 테스트와 격리 mock, 재현 방법 및 서버 후속 findings를 추가했다.

## 기존 기능 영향

게시글 목록·상세·HOT·앨범 평가·평균 평점·앨범 상세·리뷰·글쓰기·화면 전환·정상 HTTPS 이미지·YouTube embed를 확인했다. 작은따옴표, `%`, `:::`가 포함된 앨범 이름도 안전하게 선택·이동한다. 최신 main의 푸터·개인정보 모달·회원가입 약관 동의·사이드바 순서·“나도 평가하기” 기능을 보존했다. 새 앨범 글쓰기 진입점에도 원래 문자열을 안전하게 전달하고 전용 회귀·보안 테스트를 추가했다. CSS/디자인과 Supabase schema/API 필드는 변경하지 않았다.

HTTP/상대 URL/잘못된 이미지 URL은 표시하지 않는다. YouTube는 watch/embed/youtu.be 형식을 지원하며 잘못된 host/ID와 미지원 형식은 글자로 남는다. 원래 handler가 없는 헤더 게시글 검색은 구현하지 않았다. 테스트한 검색은 앨범 검색이다.

## 테스트

```sh
npm ci
npx playwright install chromium
npm test
npm run test:baseline
git diff --check
```

- Chromium 데스크톱/모바일 viewport에서 22개 시나리오씩 실행했다.
- 목록/상세/HOT 클릭, 앨범 평균·리뷰, 글쓰기, 검색·선택·평점, mock 업로드/저장/수정/추천, 빈 상태를 확인했다.
- HTML/script/img-event/SVG/srcdoc/quote 탈출/JS 문자열/실행 scheme/malformed URL/중첩 media를 검사했다.
- 수정 전 기준 커밋을 격리 환경에서 재생하여 XSS 3건과 기존 escape 보호 대조 1건을 검증했다.
- 모든 HTTP 요청은 로컬 응답 또는 차단, Supabase는 메모리 mock이다. production DB와 duli.kr에는 접속하거나 payload를 저장하지 않았다.

## 테스트 결과

**PASS — 수정본 44/44, baseline 4/4, diff whitespace 검사 통과.**

수정본에서 공격자 JavaScript/alert/dialog, 공격자가 만든 event attribute·예상하지 않은 scriptable element, 임의 iframe URL이 없었다. runtime exception, browser console error, 예상하지 않은 네트워크 요청도 0건이었다. 정상 기능의 예상 alert는 별도로 검증했다.

초기에는 Chromium 설치 revision 불일치로 실행 전 실패했고, browser 설치 및 최신 main 통합 후 모두 통과했다. 통합 중 남은 충돌 마커로 중간 실행에서 실패가 발생했고, 마커 제거 후 전체 테스트를 다시 실행했다. 실제 YouTube 재생·실제 Supabase/Auth/Storage·Firefox/WebKit은 테스트하지 않았다.

## 이번 PR에서 다루지 않은 내용

Supabase 관리자 접근이 없어 RLS, update/delete authorization, 관리자 권한 검증, 추천 조작 방지, 조회수 atomic update, Storage policy, 서버 파일 크기/MIME 제한, Auth 정책, rate limiting, DB constraint를 검증·수정하지 못했다. 이 항목들이 안전하다고 판단하지 않는다. 항목별 관찰과 필요한 서버 작업은 보안 보고서에 분리했다.

CDN 공급망, 전체 CSP 전환, 외부 HTTPS 이미지 추적 방지, 기존 DB 데이터 정리도 범위 밖이다. 이 PR은 frontend XSS 경로를 수정하며 사이트 전체 보안 인증을 의미하지 않는다.

## 요약

이번 PR은 새로운 기능을 추가하는 작업이 아니라, 게시글·앨범 등 사용자 데이터가 브라우저에서 프로그램 코드로 실행될 수 있는 경로를 차단하는 frontend 보안 패치다. 기존 화면과 정상 기능은 최대한 유지했으며, 외부 통신 없는 로컬 브라우저 테스트와 후속 검토 문서를 함께 제공한다.
