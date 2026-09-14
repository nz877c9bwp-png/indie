# Sign in with Apple 설정 (한 번만)

앱 코드는 이미 들어가 있다(`appleAuth()` → Supabase OAuth). 아래 설정을 끝내야 버튼이 실제로 동작한다.
심사 지침 4.8: 카카오 로그인을 제공하는 앱은 Apple 로그인(또는 동급)을 반드시 함께 제공해야 한다.

## 1. Apple Developer (developer.apple.com → Certificates, Identifiers & Profiles)

1. **App ID `kr.duli.app`**: Sign in with Apple capability가 켜져 있는지 확인. (Xcode 빌드 시 자동 등록됨. 안 켜져 있으면 체크 후 Save)
2. **Identifiers → + → Services IDs**
   - Description: DULI Web
   - Identifier: `kr.duli.web`
   - 등록 후 다시 열어 Sign in with Apple 체크 → Configure
     - Primary App ID: `kr.duli.app`
     - Domains: `jvitmimabxupkhrksudu.supabase.co`
     - Return URLs: `https://jvitmimabxupkhrksudu.supabase.co/auth/v1/callback`
3. **Keys → + **
   - Name: DULI Sign in with Apple
   - Sign in with Apple 체크 → Configure → Primary App ID `kr.duli.app`
   - 다운로드한 `.p8` 파일과 Key ID를 보관 (다시 못 받음)

## 2. Supabase (Dashboard → Authentication → Providers → Apple)

- Enable Sign in with Apple: ON
- Client IDs: `kr.duli.web,kr.duli.app`
- Secret Key (for OAuth): 아래 스크립트로 만든 JWT를 붙여 넣기

```bash
# 값 4개를 채우고 실행. 출력된 문자열이 Secret Key.
# 유효기간 최대 6개월 → 만료 전 다시 만들어 갱신해야 한다 (달력에 표시).
TEAM_ID=X935ZRW8JM KEY_ID=<Key ID> CLIENT_ID=kr.duli.web P8=~/Downloads/AuthKey_<Key ID>.p8 \
ruby -rjwt -e '
  key = OpenSSL::PKey::EC.new(File.read(ENV["P8"]))
  now = Time.now.to_i
  puts JWT.encode({iss: ENV["TEAM_ID"], iat: now, exp: now + 86400*180, aud: "https://appleid.apple.com", sub: ENV["CLIENT_ID"]}, key, "ES256", kid: ENV["KEY_ID"])
'
```

`gem install jwt` 가 필요하다. ruby가 없으면 Supabase 문서의 Node 스크립트를 써도 된다.

## 3. Authentication → URL Configuration

Redirect URLs에 `https://duli.kr` 이 있는지 확인 (카카오 때 이미 넣었으면 그대로).

## 확인

duli.kr → 로그인 → "Apple로 로그인" → Apple 계정 인증 후 duli.kr로 돌아오면 끝.
마이페이지 설정 탭에 가입 방식이 "Apple 로그인"으로 뜬다.
