# Frontend Stored XSS 검토 및 수정 보고서

검토일: 2026-09-10. 기준 커밋: `dce21b9fd5d01f8aeeb32e5eeb1b1221e5cd0950`.
작업 브랜치: `security/xss-fix`. 범위: repository frontend와 로컬 테스트/문서.

## 배경과 범위

Stored XSS는 **게시글에 단순 글자가 아니라 실행 가능한 HTML/JavaScript가 숨어 들어가 DB에 저장되고, 다른 사용자가 해당 화면을 볼 때 그 코드가 실행될 수 있는 문제**다. DB에서 읽은 값도 신뢰할 수 있는 HTML이 아니다.

`index.html` 전체(HTML/CSS/JavaScript), 모든 DOM 삽입, 속성 할당, inline handler, 데이터 저장/조회 경로를 검토했다. `CNAME` 외에 기존 application 파일은 없다. Supabase/Storage/Auth/CDN/iTunes가 외부 의존성이다. Supabase 서버 설정이나 실제 저장 데이터는 조회하거나 변경하지 않았다. 공격 데이터가 운영 DB에 저장 가능한지, 실제 공격 이력이 있는지는 확인하지 않았다.

## Attack surface: 수정 전 판정

U = 사용자 입력·DB·외부 API·Auth metadata로서 신뢰하지 않는 값. T = repository에 고정된 코드/문구. 아래의 “미재현”은 안전성의 포괄적 보증이 아니라 이번 검토에서 실행 경로를 확인하지 않았다는 뜻이다.

| 데이터 → 화면/경로 | 신뢰 | HTML parser 통과 | Stored XSS / 코드 실행 판정 | 속성 주입 | URL scheme 주입 |
| --- | --- | --- | --- | --- | --- |
| post.title → 일반 목록 | U | `esc` 후 통과 | 기존 escape로 테스트 payload 실행 안 됨 | 텍스트 문맥에서 차단 | 해당 없음 |
| post.author → 일반 목록 | U | `esc` 후 통과 | 위와 같음 | 차단 | 해당 없음 |
| post.tag → 목록 badge | U | `esc` 후 통과 | 코드 검토상 escaping 적용 | 차단; class는 고정 분기 | 해당 없음 |
| title/author → HOT | U | `esc` 후 통과 | 코드 검토상 escaping 적용 | 차단 | 해당 없음 |
| title/author/tag/date → 상세 | U | 아니오: `textContent` | 이 경로의 HTML 실행 없음 | 없음 | 해당 없음 |
| id → 목록/HOT/review onclick | U | 숫자로 변환 후 handler 소스에 삽입 | `Number` 결과로 임의 코드 주입 차단 | 임의 문자열은 안 들어감 | 해당 없음 |
| views/recs/rating/count/date → 목록·HOT·평점 | U/계산값 | Number/날짜/escape 후 통과 | 임의 HTML 삽입 미확인; 값 무결성은 별개 | 없음 | 해당 없음 |
| album_title/album_artist → 앨범 카드 글자 | U | `esc` 후 통과 | 표시 문맥은 escaping 적용 | 차단 | 해당 없음 |
| album_title/album_artist → 앨범 카드 onclick | U | URL 인코딩 후 JS 문자열에 삽입 | **저장된 title로 클릭 시 alert 실행 재현**. artist도 동일한 문자열 문맥 | 작은따옴표가 JS 문자열을 탈출 | 해당 없음 |
| album_cover → 앨범 카드 img.src | U | raw 문자열 삽입 | **onload 생성 및 실행 재현** | **가능** | 검증 없음; javascript: img 단독 실행은 주장하지 않음 |
| album_title/artist → 앨범 상세·선택 화면 | U | 아니오: `innerText` | 표시 자체는 text | 없음 | 해당 없음 |
| album_cover → 상세/선택 img.src | U | 아니오: DOM 속성 할당 | 속성 탈출 없음; scheme 검증은 누락 | 없음 | 미검증 URL 할당 가능 |
| review title/author → 앨범 상세 | U | `esc` 후 통과 | 기존 escape 보호를 baseline에서 확인 | 차단 | 해당 없음 |
| review content preview | U | escape → media HTML → regex 태그 제거 → HTML | 일반 HTML payload 실행 안 됨. 복잡한 재파싱 제거 대상 | 직접 탈출 미재현 | media 변환 경유 |
| 본문 일반 문자열/HTML | U | `esc` 후 통과 | 일반 HTML payload는 글자로 표시됨 | 직접 탈출 미재현 | 일반 문자열은 링크가 아님 |
| `[img]URL[/img]` | U | escape 후 img HTML 문자열 생성 | **단순 quote 탈출은 기존 escape로 막힘**. 이를 확인된 XSS로 과장하지 않음 | baseline quote 테스트에서 src만 생성 | scheme/URL 검증 없음 |
| YouTube 본문 링크 | U | regex로 iframe HTML 생성 | ID 문자는 제한됨. 임의 iframe URL 실행 미재현 | 입력 자체의 속성 탈출 미확인 | 고정 embed origin이나 원본 host/경계 검증 불충분 |
| 이미지 안의 YouTube 문자열 | U | 생성된 img HTML을 다시 regex 처리 | 중첩된 HTML 생성 가능; 독립적인 실행 exploit은 미확인 | 문맥 혼합 위험 | 이번에 단일 token 파싱으로 제거 |
| iTunes collectionName/artistName → 검색 글자 | U | `esc` 후 통과 | 표시 문맥은 escaping 적용 | 차단 | 해당 없음 |
| iTunes 이름 → 검색 onclick | U | URL 인코딩 후 JS 문자열에 삽입 | **외부 검색 title로 클릭 시 alert 실행 재현**. 검색 단계는 DB 저장 전 DOM XSS | JS 문자열 탈출 가능 | 해당 없음 |
| iTunes artworkUrl100 → 검색 img/onclick | U | raw 속성/JS 문자열 | 코드 검토에서 raw 삽입 확인; 별도 baseline 실행 재현은 안 함 | HTML/JS 양쪽 문맥에 삽입 | 검증 없음 |
| nickname/email prefix → userStatus | U | `esc` 후 통과 | 기존 escaping 적용 | 차단 | 해당 없음 |
| nickname/title/author/content/tag → form.value | U | 아니오 | HTML 실행 없음 | 없음 | 해당 없음 |
| Storage publicUrl → textarea.value → 저장된 본문 | U | textarea 단계는 아니오 | 저장 후 본문 media renderer가 신뢰 경계 | 본문 경로 참조 | 본문 경로 참조 |
| 검색어/searchType → iTunes 요청 | U/고정 select | DOM 삽입 없음 | 검색어는 URL 인코딩; 응답은 위 검색 경로 | 해당 없음 | origin은 고정 |
| API 오류 → alert, 선택 category → boardTitle | U/T | 아니오 | alert의 내용/innerText는 HTML 실행 안 함 | 없음 | 해당 없음 |
| 앨범 상세·게시글의 나도 평가하기 → 글쓰기 | U | 아니오: DOM에서 읽은 값/closure 인자를 value·text로 전달 | 최신 main 통합 후 hostile metadata로 실행 없음 확인 | 문자열을 handler 소스로 생성하지 않음 | 표지는 imageUrl로 검증 |
| 고정 HTML/inline onclick/href/빈 상태 | T | 예 | 사용자 값 보간 없음 | 사용자 유래 주입 없음 | 기존 javascript:void(0)은 고정 코드 |

헤더의 일반 “게시글 검색” input/button에는 원래 검색 handler가 없다. 이번에 기능을 추가하거나 정상 검색이 된다고 보고하지 않았다. 테스트의 검색은 **앨범 검색**이다.

## 실제 재현한 취약점

`npm run test:baseline`은 위 기준 커밋의 HTML을 Git에서 읽어 격리된 mock 페이지에 렌더링한다.

1. `album_cover = https://assets.test/cover.png" onload="window.__xss++;alert(731)` → 앨범 이미지에 `onload`가 생기고 로컬 mock 이미지 로드 시 실행됐다.
2. `album_title = '-alert(732)-'` → URL 인코딩 후에도 `'`, `-`, `(`, `)`가 남아 `openAlbumDetail` inline JS 문자열에서 벗어났다. 앨범 카드 클릭으로 alert가 실행됐다.
3. iTunes `collectionName = '-alert(733)-'` → 같은 원리로 검색 카드 클릭 시 실행됐다.
4. 별도 대조 테스트에서 이미 escape되던 title/author/review/body는 문자열로 표시됐고, `[img]` 단순 quote payload는 새 event attribute를 만들지 않았다.

baseline의 PASS는 **취약한 구버전에서 예상한 재현 결과를 확인했다는 뜻**이며 수정본이 취약하다는 뜻이 아니다. 모든 payload는 로컬 메모리에서만 사용했다.

## 수정 설계

- `element()`가 `textContent`로 문자열을 넣고, 목록/HOT/앨범/review/검색/nickname은 `replaceChildren`와 DOM API로 구성한다.
- 동적 inline onclick을 `addEventListener` closure로 대체했다. 앨범 이름을 JS 코드나 URL 인코딩 문자열로 만들지 않고 원래 값 그대로 전달한다. 앨범 묶음의 key도 JSON 배열로 만들어 `:::`를 포함한 이름을 보존한다.
- `imageUrl()`은 절대 `https://` URL만 허용하고 URL parser로 검증한다. credentials, raw whitespace/quotes/angle brackets/backslashes, 잘못된 URL, 다른 scheme은 거부한다. `%22` 같은 URL 인코딩 문자는 DOM src 값 안에만 남는다.
- 본문과 모든 표지 이미지에 같은 검증을 적용했다. 잘못된 본문 image marker는 글자로 남고, 잘못된 표지는 `src`를 제거한다. HTTP/상대 URL/공백·raw quote가 있는 기존 이미지 URL은 더 이상 표시되지 않는다.
- 본문은 `contentParts()`에서 한 번 token화한 뒤 text node, 검증된 img, 검증된 YouTube iframe으로 만든다. 이미지 URL 안의 YouTube 문자열을 다시 embed로 해석하지 않는다.
- YouTube 지원: `youtube.com`/`www.youtube.com`의 `/watch?v=ID`, `/embed/ID`, `youtu.be`/`www.youtu.be`의 `/ID`. http/https 또는 scheme 없는 주소를 인식한다. ID는 정확히 11자의 영문·숫자·`_`·`-`. credentials와 비표준 port를 거부한다. iframe URL은 항상 `https://www.youtube.com/embed/ID`로 생성한다. Shorts/live/임의 host/잘못된 ID는 글자로 남긴다.
- 리뷰 preview는 동일한 token의 일반 글자만 150자까지 표시하고 `...`를 붙인다. 유효한 media는 생략한다. HTML 생성/태그 제거/HTML 재해석을 하지 않는다. 본문 줄바꿈은 기존 CSS `white-space: pre-wrap`으로 보존한다.
- 남은 `innerHTML` 6곳은 검색 진행/결과 없음/오류, HOT 없음, 앨범 없음, 게시글 없음의 **고정 literal**이다. HTML의 정적 inline handler도 사용자 값이 들어가지 않아 유지했다. CSP 전체 전환은 하지 않았다.

안전한 DOM sink 선택은 [OWASP DOM XSS Prevention 지침](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)의 textContent/createElement 원칙을 따른다.

## 테스트와 결과

환경: Node.js 24.18.0, Playwright 1.63.0, Chromium headless 153.0.8010.12. 1280×900 데스크톱, 390×844 모바일 viewport. 실제 Android/iOS 기기는 아니다.

| 실행 | 결과 |
| --- | --- |
| `npm test` | **PASS: 44/44**, 22개 시나리오 × 2 viewport |
| `npm run test:baseline` | **PASS: 4/4**, 구버전 실행 경로 3개 + 기존 escape 보호 대조 1개 |
| `git diff --check` | **PASS** |

회귀: 일반 목록/title/author/tag, 게시글 클릭·상세·목록 복귀, HOT 표시·클릭, 정상 본문/줄바꿈, 실제 mock 이미지 디코딩, YouTube iframe, 앨범 카드·평균 4점·리뷰 수, 상세 review title/author/preview·클릭, 글쓰기·미리 선택된 앨범, 작은따옴표/%/`:::` 이름, 앨범 검색·선택·평점, mock 업로드·insert 필드, mock 추천·관리자 수정 update 필드, 로그인 상태 표시/로그아웃 상태의 글쓰기 제한, 빈 목록/검색 결과 없음.

보안: 10종 text payload를 DB/검색/Auth 표시 경로에 주입; script/img-onerror/svg-onload/srcdoc/HTML entities/JS 문자열 탈출/attribute injection 포함. image URL 16종 거부 입력, 표지 URL 5종, YouTube 정상 5종/거부 13종, media 중첩, 인코딩된 quote와 stale src 제거를 확인했다. 예상하지 않은 scriptable element, `on*`/srcdoc 속성, 실행 scheme, 임의 iframe src, `window.__xss` 변화가 없었다.

수정본 **공격자 alert/dialog 0, pageerror 0, browser console error 0, 예상하지 않은 네트워크 요청 0**. mock 저장·추천·로그인 제한에 따른 정상 alert는 예상값과 비교했다. Node runner의 NO_COLOR/FORCE_COLOR 경고는 application browser 오류가 아니다.

초기 실행은 설치된 Chromium revision 불일치로 실행 전 실패했다. `npx playwright install chromium`으로 맞는 browser를 설치한 후 baseline 4개와 수정본 42개 모두 통과했다. 최신 main 통합 중 충돌 마커가 남은 중간 실행에서 실패가 발생했다. 마커 제거 후 전체 테스트를 재실행했다.

## 테스트 격리와 한계

`tests/harness.js`는 시작 전에 Supabase SDK를 메모리 mock으로 대체한다. 모든 HTTP 요청을 route에서 로컬 fulfill하거나 abort하며 `route.continue`/`route.fetch`를 사용하지 않는다. production 도메인/DB로 허용되는 경로는 없다. 조회수 update, insert, 업로드도 실제 서버로 보내지 않는다. Service worker는 차단한다. 자세한 실행법은 [tests/README.md](../tests/README.md)를 참고한다.

실제 Supabase/Auth/Storage/iTunes/CDN 가용성, 실제 YouTube 재생, production 데이터, 서버 정책, Firefox/WebKit은 검증하지 않았다. 사진은 로컬 PNG로 실제 img 디코딩을 확인하고 영상은 로컬 iframe 응답으로 URL과 DOM을 검증했다. 테스트 범위에서 통과한 frontend 패치이며 사이트 전체의 보안을 보증하지 않는다.

## Supabase 접근이 필요한 별도 findings

아래는 frontend에서 관찰한 패턴과 확인할 서버 항목이다. **운영 설정이 취약하다고 단정하거나 안전하다고 판정하지 않았다.**

| 항목 | 관찰/확인할 문제 | frontend만으로 해결? | Supabase 접근 필요? |
| --- | --- | --- | --- |
| RLS | 브라우저가 posts를 직접 select/insert/update/delete. 테이블 policy 적용 여부 불명 | 아니오 | 예: policy와 역할별 권한 확인 |
| update/delete authorization | 요청은 id 조건으로 보냄. 작성자/역할 검증을 서버가 수행하는지 불명 | 아니오 | 예: 소유권·역할 policy |
| 관리자 검증 | `ADMIN_EMAIL`과 UI 버튼 표시로 판단. 클라이언트 변수/함수 호출은 권한 경계가 될 수 없음 | 아니오 | 예: 신뢰 가능한 role/claim 검증 |
| 추천 조작 | localStorage 제한 + 클라이언트 계산값 update. 우회 방어 정책 불명 | 아니오 | 예: 중복 제한과 서버 측 처리 |
| 조회수/atomic increment | 페이지를 열면 읽어 둔 값 + 1 update. 동시 요청 손실/임의 값 방어 불명 | 아니오 | 예: 서버 원자 증가·접근 제어 |
| Storage upload policy | images bucket 직접 upload/public URL 사용. 업로드·읽기 권한 불명 | 아니오 | 예: bucket policy |
| 파일 크기/MIME | input accept=image/*만 있음. 크기·실제 파일 형식 제한은 확인 불가 | UX 제한만 가능, 강제 불가 | 예: 서버 검증/제한 |
| Auth 정책 | 이메일/password 로그인과 가입 사용. 이메일 확인·세션·비밀번호 정책 불명 | 아니오 | 예: Auth 설정 확인 |
| Rate limiting | 반복 가입/작성/업로드/추천 제한을 frontend만으로 보장 불가 | 아니오 | 예: 서버/게이트웨이 설정 |
| DB constraints | tag/rating/길이/필수값/소유자 제약 불명. 표시 시 Number 변환은 무결성 검증이 아님 | 아니오 | 예: constraint/schema 검토 |

현재 브라우저에 있는 Supabase key는 anon 역할을 사용하는 공개 클라이언트 키다. 이를 service-role 비밀키 유출로 기록하지 않았다. 안전한 사용을 위해 필요한 서버 policy는 이번에 확인하지 못했다. HTTPS 외부 이미지는 계속 허용하므로 제3자 요청·추적 방지나 파일 내용 검사는 이 수정의 범위가 아니다. CDN 스크립트의 공급망/버전 고정, 정적 inline 코드와 CSP도 후속 검토 항목이다.

## 핸드오버

변경: `index.html`, `.gitignore`, `package.json`, `package-lock.json`, `playwright.config.js`, `tests/` 및 `docs/`. 앞선 요청에서 생성된 `AGENTS.md`는 수정하지 않았으며 보안 diff에 포함하지 않았다. `CNAME`, Supabase URL/key/schema/API contract는 변경하지 않았다.

예정 commit: `fix: prevent stored XSS in user-generated content`.
예정 PR 제목: `Fix stored XSS vulnerabilities in user-generated content`.
[PR 본문 전체](xss-pr-draft.md)를 함께 제공한다. 최초 핸드오버에서는 commit/push/PR/merge를 보류했다. 이후 사용자 요청으로 PR을 게시하며, main merge는 메인 작업 담당자의 검토에 맡긴다.

판단: **이번 frontend XSS 패치 범위에서는 테스트를 통과하여 사용자 코드 검토 후 merge 가능한 상태**다. Supabase의 인가/정책까지 안전하다는 판정은 아니다. main에 직접 push하거나 merge하지 않는다.

PR 게시 전 `origin/main`의 `cfb05d6` 위로 rebase했다. upstream의 푸터·개인정보 모달·회원가입 약관 동의 기능을 보존했으며 전용 회귀 테스트를 추가했다. 해당 통합 시점에 수정본 42개와 baseline 4개가 통과했다.

### PR #2 충돌 해결

PR 게시 후 main에 `0212d5e`가 추가되어 앨범 글쓰기 함수의 수정/삭제 충돌이 발생했다. main을 `security/xss-fix`에 병합하여 새 `openWriteWithAlbumParams`와 “나도 평가하기” 버튼, 사이드바 순서, 모바일 버튼 줄바꿈을 유지했다. 삭제된 구 함수는 복구하지 않았다. 새 함수의 `selectAlbum` 호출은 URL 인코딩 없이 원래 문자열을 전달하도록 맞췄다. 그렇지 않으면 보안 패치의 DOM text renderer에서 한글·특수문자가 퍼센트 인코딩된 채 표시된다.

신규 버튼의 표시 조건, 글쓰기 이동·앨범 선택·평점, 상세 화면 진입점, scriptable 앨범명/가수명, 잘못된 표지 scheme을 데스크톱·모바일에서 추가 검증했다. 통합 결과는 `npm test` **44/44 PASS**, `npm run test:baseline` **4/4 PASS**다. main에는 직접 push/merge하지 않고 PR 브랜치만 업데이트한다.
