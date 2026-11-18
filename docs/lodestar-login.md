# 로드스타 로그인

개발자: 홍서진. 원본 장면/엔진과 사용자 닉네임/외형 선택은 유지한다. 서버에서 검증한 로그인 신원은 `presence.identity={issuer,sub,name}`이며 장면의 닉네임 필드 `n`과 별개다. 클라이언트가 identity를 제출하면 스키마 검증에서 거부한다. 익명은 `identity:null`이다. 다른 참가자에게도 이 신원 정보가 전달된다.

## 환경변수

| 변수 | 설정 |
|---|---|
| LODESTAR_ISSUER | 기본 `https://lodestar-rho.vercel.app`, OAuth origin |
| LODESTAR_CLIENT_ID | 승인된 `ldi_client_…` 공개 ID |
| LODESTAR_REDIRECT_URI | 정확한 `/auth/lodestar/callback` URL |
| SESSION_SECRET | 로컬에서 생성한 최소 32바이트 비밀값. 커밋/보고/로그 금지 |
| AUTH_REQUIRED | `1`이면 로그인 필수, 기본 익명 허용 |
| NODE_ENV | `production`이면 issuer와 callback 모두 HTTPS 필수 |

CLIENT_ID/REDIRECT_URI/SESSION_SECRET 중 누락이 있으면 로그인 비활성이다. 전체 설정이 있지만 잘못된 URL/ID/짧은 비밀값이면 시작을 실패시켜 오설정을 드러낸다. 개발 HTTP는 localhost/127.0.0.1/IPv6 loopback에서만 허용한다. 실제 Lodestar의 HTTP callback 등록 허용은 localhost/127.0.0.1이므로 그 둘을 사용한다.

개발 예시 공개 설정: `ldi_client_dawn_laundry_dev`, `http://localhost:5173/auth/lodestar/callback`. 앱을 반드시 같은 `localhost:5173`에서 열어야 한다. `127.0.0.1`과 `localhost`는 다르다. Lodestar의 현재 문서 예시는 3000 포트이므로 앱 PORT를 3000으로 바꾸거나 등록 콜백을 5173으로 별도 승인해야 한다. `.env.example`은 활성화된 자격정보가 아니다.

Lodestar 관리자 측 선행 작업: identity scope DB 마이그레이션 및 코드 배포, `OAUTH_IDENTITY_CLIENTS`에 동일 ID/정확한 콜백 등록(HTTP 로컬은 `development:true`). 이번 앱 작업에서는 해당 작업을 수행하지 않는다. 동적 클라이언트 등록이나 client secret은 사용하지 않는다.

## 흐름

```text
브라우저 시작 화면 → GET /auth/session → 익명/로그인 신원 및 입장 정책
로그인 버튼 → GET /auth/lodestar/start
  서버: 무작위 state + verifier, S256 challenge, 브라우저 바인딩 쿠키
→ Lodestar /auth/mcp/authorize (scope=lodestar:identity)
→ GET /auth/lodestar/callback?code=…&state=…&iss=…
  서버: 바인딩/유효기간/state/issuer 검사, 일회용 흐름 소모
  서버 → POST Lodestar /api/oauth/token (PKCE verifier)
  서버 → GET Lodestar /api/oauth/userinfo (Bearer)
  서버: 검증된 신원만 메모리에 저장, 토큰은 저장하지 않음
→ HttpOnly·SameSite=Lax·Secure 세션 쿠키 → 시작 화면
→ WS /realtime: 쿠키 검증 → 서버가 presence.identity 부착
로그아웃 POST /auth/logout: 동일 Origin 검사 → 세션 폐기/기존 WS 종료
```

콜백 중복 파라미터와 issuer 불일치를 거부하며, state는 토큰 요청 전에 소모한다. HTTP 개발 loopback 예외에서만 Secure를 생략한다. 세션 쿠키는 HMAC 서명된 무작위 ID이고 토큰·신원은 포함하지 않는다. 인증 응답은 no-store/no-referrer이고 서비스 워커 인증 캐시 대상이 아니다. 요청 URL/토큰/오류 응답 원문은 로그에 남기지 않는다. HTTPS reverse proxy는 Host를 등록된 앱 origin과 같게 전달해야 한다. 임의 forwarded 헤더는 신뢰하지 않는다.

## 로컬 단계 제한

단일 Node 프로세스 메모리 세션이며 재시작하면 로그인/대기 흐름이 소실된다. 대기 5분, 세션 최대 1시간(토큰 expires_in보다 길지 않음), pending 1,000 / session 10,000 상한이다. 갱신·영속 DB·다중 인스턴스 공유·분산 rate limit은 구현하지 않았다. 세션 종료는 WS 메시지와 heartbeat(기본 15초)에 검사한다. 로그아웃은 즉시 연결 종료한다.

앱 로그아웃은 **앱 세션만** 해제한다. 토큰을 보관하지 않으므로 Lodestar refresh/revoke는 호출하지 않는다. Lodestar에서 사용자를 제거하거나 연결을 해제해도 기존 앱 세션은 만료까지 최대 1시간 남을 수 있다. 재로그인할 때 userinfo를 다시 확인한다. 실서비스 전에는 이 지연 정책과 전역 해제를 검토해야 한다.

`npm run build && npm test`로 기존 HTTP/WS와 로컬 가짜 OAuth 통합 및 UI 상태 테스트를 검증한다. 실제 Google 동의/배포 Lodestar/브라우저 렌더링은 별도 미검증이다.
