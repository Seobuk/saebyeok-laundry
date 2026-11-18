# 실시간 어댑터 계약

`window.Realtime.create({room, onCorrection}) -> Promise<Adapter>`를 engine.js의 hook()에서 호출한다. `room`은 `laundry` / `spa`. 전송 방식은 셋이다.

| 순서 | 전송 | 고르는 조건 |
|---|---|---|
| 1 | Claude room | `window.claude.use`가 있으면 기존 Claude room 객체를 그대로 돌려준다 |
| 2 | lodestar | 빌드 설정 `window.APP_CONFIG.backend === 'lodestar'` (`npm run build:lodestar`) |
| 3 | local-ws | 그 밖(기본 `npm run build`). 페이지 기준 상대 주소 `realtime?room=…` WebSocket |

장면 파일(`laundry.js`·`spa.js`)과 엔진의 presence 형식은 어느 전송에서도 바뀌지 않는다. 입력 검증은 `src/realtime/validate.js` 하나를 서버(`server/state.js`)와 브라우저가 같이 쓴다.

## 공통 어댑터 인터페이스

- `presence(state) -> Promise`: 내 휘발성 상태 송신. 결과는 `{accepted, presence, requested?, reason?}`. 연결 끊김·전송 실패는 reject. 연결 전 전송은 보관하지 않고, 엔진이 재접속 때 최신 상태를 다시 보낸다.
- `onPeers(callback, onClose?)`: `{joined:[], updated:[], left:[]}` 변화분. 항목은 `{peer, kind:'viewer', sameTab:false, presence}`, `left`는 `{peer}`. 자기 자신 제외. 연결 직후 기존 참가자 snapshot을 `joined`로 보내고 다음부터 변화분을 보낸다.
- `onConnection(callback, onClose?)`: boolean 연결 상태. 등록 즉시 현재 값을 한 번 부른다. false면 엔진이 표시된 peers를 지우고, true면 자기 현재 상태를 다시 보낸다.
- `close()`: 종료·재연결 취소(선택 확장). `pagehide`에서 부르고, bfcache 복귀(`pageshow.persisted`) 때 다시 연결한다.
- `onCorrection({accepted:false, requested, presence, reason:'occupied'})`: 세탁기 점유가 거절되거나 잃었을 때. hook이 내 세탁기 필드·도착 콜백·자세를 `presence` 값으로 되돌리고 안내한다.

### Presence 형식 (13개 필드, 이 외 키는 거부)

| 필드 | 형식 |
|---|---|
| `in` | 정수 0~1 (입장 여부) |
| `x`, `z` | 유한수 -100~100 |
| `fy` | `null` 또는 유한수 -100~100 |
| `a` | 정수 0~7 (자세) |
| `n` | 정수 0~7 두 개 배열 (닉네임 조합) |
| `l` | 정수 3개 배열, 각각 0~5 / 0~4 / 0~3 (외형) |
| `t`, `c` | 정수 0~1 |
| `m` | 정수 -1~3 (세탁기 번호, -1은 없음) |
| `ms` | 정수 0~2 (세탁기 상태) |
| `mu` | 0 이상 유한수, Unix 밀리초 (세탁 끝 시각) |
| `f` | 정수 0~20 |

방 규칙(`normalize`): 스파 방이거나 `in=0`이거나 `m<0`이면 `m=-1, ms=0, mu=0`. 그 밖에는 `mu`를 지금+10분으로 자른다. JSON(UTF-8) 크기 상한은 2048바이트다.

## local-ws wire 형식

요청: `{type:'presence',id:양의정수,presence:{…13개 필드}}`.
응답: `{type:'ack',id,accepted,presence,requested?,reason?}` 및 `{type:'peers',joined?,updated?,left?}`.
서버가 소켓별 UUID를 배정한다. 클라이언트가 타인의 ID를 지정할 수 없다. 방은 두 개의 허용 목록만 받는다. JSON 2048바이트, 초당 20건 제한, 필드/타입/배열 크기/범위 검증, binary 거부. Origin이 있으면 HTTP Host와 일치해야 한다. 신뢰할 수 없는 Origin은 403으로 거절한다. 이 서버는 기본 localhost에만 바인딩하며 공개 운영용 인증·IP별 제한·TLS·다중 인스턴스 저장소는 별도 결정이다.

세탁기 번호는 방 상태 Map에서 동기적으로 먼저 접수한 소켓이 차지한다. 같은 번호를 다른 참가자가 요청하면 이전 서버 상태를 돌려준다. `m=-1`, `in=0`, 소켓 종료 또는 heartbeat 실패 시 반납한다. 15초마다 ping, 다음 주기까지 pong이 없으면 상태를 즉시 제거하고 terminate한다(약 15~30초). 세탁 시간/빨래 소유권 전체 게임 규칙은 서버 권위로 바꾸지 않았으며, 클라이언트가 보내는 만료 시각은 10분 상한만 둔다.

Claude room은 원본 호스트의 중계 기능이며 local-ws 서버 중재가 적용되지 않는다.

## lodestar 전송 계약

로드스타(같은 출처)가 빌드 산출물을 정적으로 서빙하고, 브라우저가 로드스타 로그인 세션으로 Supabase Realtime 비공개 채널에 직접 붙는 방식이다. 이 저장소에는 Supabase 주소·anon 키·프로젝트 식별자·토큰이 들어가지 않는다. 전부 실행 중에 세션 API로 받는다. 아래 항목은 로드스타 쪽 구현이 그대로 맞춰야 하는 계약이다.

### 1. 빌드와 서빙

- `npm run build:lodestar` = `BACKEND=lodestar`, `BASE=/apps/saebyeok/`(기본값). 결과 `dist/`를 그대로 `/apps/saebyeok/` 아래에서 서빙한다.
- 페이지: `saebyeok-laundry.html`, `ttasun-spa.html`. 모든 자산 참조는 상대 경로다. `BASE`는 로그인 복귀 경로 계산에만 쓴다.
- 산출물 추가 파일: `vendor/three.min.js`(npm `three` 0.128.0 = r128의 `build/three.min.js`, 수정 없음, MIT `licenses/THREE-MIT.txt`, 일반 빌드에도 들어감), `vendor/supabase.js`(@supabase/supabase-js 2.118.0 UMD, 수정 없음, MIT `licenses/supabase-js-MIT.txt`), `realtime/validate.js`.
- 외부 스크립트는 없다. 모든 `<script src>`는 같은 출처의 상대 경로다. 페이지가 외부에서 불러오는 것은 Google Fonts CSS(`fonts.googleapis.com` → 글꼴 `fonts.gstatic.com`)뿐이다. 인라인 `<script>` 4개(설정, 장면, 엔진, 서비스 워커 등록)와 인라인 `<style>` 1개가 있다. CSP를 걸면 `script-src`는 `'self'`와 이 스크립트 해시면 되고, `connect-src`에 Supabase `https://`·`wss://` 주소가 필요하다.
- `*.webmanifest`는 브라우저가 자격 증명 없이 가져올 수 있다. `.html`·`.js`는 로그인한 사용자만 받는다.
- 서비스 워커(`sw.js`, 범위 `/apps/saebyeok/`)는 목록에 있는 정적 파일만 다룬다. 리다이렉트된 응답과 확장자에 맞지 않는 형식(예: `.js` 요청에 돌아온 로그인 HTML)은 캐시하지 않는다. `/api/`를 포함한 경로·로그인 페이지·외부 출처(글꼴)는 가로채지 않는다.

### 2. 세션 API

`GET /api/apps/saebyeok/session` — 같은 출처, `credentials:'same-origin'`, `cache:'no-store'`, `Accept: application/json`.

| 상태 | 의미 | 앱 동작 |
|---|---|---|
| 200 | 허용 목록 회원 | 아래 본문으로 입장 허용 |
| 401 | 로그인 안 됨 | 로그인 링크 `/login?next=` + `encodeURIComponent(BASE + 페이지 파일명)` 표시, 입장 잠금 |
| 403 | 로그인했지만 회원 아님 | "허용 목록에 없음" 표시, 입장 잠금 |
| 404 | 서비스 꺼짐 | "문을 닫았어요" 표시, 입장 잠금 |
| 그 밖 | 오류 | 새로고침 안내, 입장 잠금 |

200 본문(응답 헤더 `Cache-Control: no-store`, 이메일 넣지 않음):

```json
{
  "identity": {"issuer": "문자열 1~512자", "sub": "문자열 1~256자", "name": "문자열 1~200자 또는 null"},
  "realtime": {"url": "https://… (Supabase 프로젝트 URL)", "anonKey": "문자열 1~4096자", "accessToken": "문자열 1~8192자", "expiresAt": 1763450000}
}
```

- `expiresAt`: `accessToken` 만료 시각, **Unix 초**(숫자). 앱은 `expiresAt − 60초`(최소 10초 뒤)에 이 API를 다시 불러 새 토큰을 받는다. 그래서 응답할 때마다 만료가 충분히 남은(갱신된) 토큰을 줘야 한다. `expiresAt`가 `null`(또는 없음)이면 앱은 만료를 모르는 것으로 보고 받은 시각+5분을 만료로 삼아(실제로는 약 4분 뒤) 다시 부른다. 0 이하·숫자 아님·문자열 같은 다른 값은 잘못된 응답으로 보고 입장을 잠근다.
- `url`은 `https:`여야 한다(개발용 `http://localhost`·`127.0.0.1`·`[::1]`만 예외). 모양이 틀리면 앱은 입장을 잠근다.
- 앱은 페이지 로드 때 한 번 부르고, 같은 응답을 인증 화면과 실시간 전송이 나눠 쓴다. 이후 토큰 갱신 때와 채널 오류 뒤 재연결 때 다시 부른다. 401·403·404를 받으면 재연결을 멈춘다.
- 앱은 토큰을 메모리에만 두고 저장·로그·URL에 남기지 않는다. supabase-js는 `createClient(url, anonKey, {accessToken: async () => token, realtime: {heartbeatIntervalMs: 15000}})`로 만들고, 새 토큰을 받으면 `client.realtime.setAuth(token)`을 부른다. supabase auth 저장소는 쓰지 않는다.

### 3. 채널

- 토픽: 정확히 `saebyeok:laundry` 또는 `saebyeok:spa` (`realtime.topic()`이 돌려주는 값).
- 옵션: `{config: {private: true, presence: {key: <peer>}, broadcast: {self: false, ack: true}}}`.
- `peer`: 페이지(어댑터)마다 새로 만드는 소문자 UUID v4. 재연결해도 같은 페이지에서는 유지한다.
- 필요한 권한(로드스타 RLS): 허용 목록 회원인 `authenticated` 사용자가 위 두 토픽에서 broadcast·presence를 받기(select)와 보내기(insert). 익명·비회원은 둘 다 거부. Realtime의 공개 채널 허용은 꺼 둔다.
- 상태: `SUBSCRIBED` → `onConnection(true)`. `CHANNEL_ERROR`·`TIMED_OUT`·`CLOSED` → `onConnection(false)`, 채널 제거, 세션 API로 토큰 갱신 후 새 채널 구독. 재시도 간격 1.5초에서 두 배씩 늘려 최대 30초, 구독 성공 시 초기화.

### 4. 메시지

Broadcast 이벤트 이름 `state`, payload:

```json
{"v": 1, "peer": "<보낸 사람 peer UUID>", "seq": 12, "presence": { "…13개 필드": "…" }}
```

Presence `track` payload(키 = peer):

```json
{"v": 1, "seq": 12, "presence": { "…13개 필드": "…" }}
```

- `seq`: 보낸 사람마다 1부터 1씩 늘어나는 안전 정수. 같은 상태의 broadcast와 track은 같은 `seq`를 쓴다.
- 송신: `presence()`에 들어온 값을 검증하고 방 규칙으로 정리한 뒤, 최신 값만 남겨 200ms에 한 번(초당 5건 이하) 보낸다. broadcast 응답이 `'ok'`가 아니면 `presence()`를 reject한다. `track`은 처음, 그리고 `in`·`m`·`ms`가 바뀔 때 바로, 그 밖에는 1초에 한 번 이하로 보낸다.
- 수신 폐기 조건: 자기 peer, UUID 아닌 키, `v≠1`, `seq`가 정수 아님 또는 이미 받은 값 이하, presence 검증 실패, `{v,peer,seq,presence}` JSON이 2048바이트 초과, 상대별 초당 20건 초과(broadcast와 presence join). Presence에 없는 peer의 broadcast도 버린다. 받은 presence에는 방 규칙을 다시 적용한다.
- `onPeers` 대응:
  - presence `sync`: 현재 `presenceState()`와 비교해 새 peer는 `joined`, 사라진 peer는 `left`. 구독 직후 첫 sync가 snapshot이다. 한 키에 여러 항목이 있으면 `seq`가 가장 큰 유효 항목을 쓴다.
  - presence `join`: 처음 보는 peer는 `joined`, 아는 peer는 `updated`.
  - presence `leave`: 그 키가 `presenceState()`에서 완전히 사라졌을 때만 `left`.
  - broadcast `state`: `updated`.
- 신원: lodestar 전송의 presence에는 로그인 신원을 붙이지 않는다. 장면에는 익명 닉네임만 보인다. payload는 보낸 사람이 주장하는 값이고 회원 사이 위조를 막지 않는다.

### 5. 세탁기 점유 RPC

빨래방(`laundry`)에서만 부른다. 스파는 늘 `m=-1`이라 부르지 않는다. 모두 supabase-js `client.rpc(이름, 인자)`(로그인 사용자 권한, 이름 있는 인자)로 부른다. 반환은 JSON 객체(`jsonb`)이고 불리언 `ok`가 꼭 있어야 한다. 앱은 `ok`만 읽는다. 오류이거나 `ok`가 없으면 앱은 실패로 처리한다. 반환 키는 camelCase이고 시각은 모두 **Unix 밀리초 정수**다. 아래 표는 로드스타 `prisma/migrations/20261118100213_saebyeok_realtime/migration.sql`의 실제 정의다. 함수는 호출자가 허용 목록 회원인지 확인하고, 아니면 오류를 낸다. 임대(lease) 길이는 45초다.

| 함수 | 인자 | 성공 반환 | 실패 반환 |
|---|---|---|---|
| `saebyeok_claim` | `p_room text`('laundry'), `p_machine integer`(0~3), `p_peer text`, `p_until bigint`(세탁 끝, ms) | `{"ok":true,"machine":2,"until":…,"expiresAt":…}` | `{"ok":false,"machine":2,"holder":"<peer>","until":…,"expiresAt":…}` (그 사이 행이 사라졌으면 `holder`·`until`·`expiresAt`가 `null`) |
| `saebyeok_release` | `p_room text`('laundry' 또는 'spa'), `p_peer text` | `{"ok":true,"released":0 이상}` | (없음, 오류만) |
| `saebyeok_renew` | `p_room text`('laundry' 또는 'spa'), `p_peer text` | `{"ok":true,"renewed":1,"expiresAt":…}` | `{"ok":false,"renewed":0,"expiresAt":null}` (이 peer·회원의 임대 행 없음) |

- `p_peer`는 `text`이고 `^[A-Za-z0-9_-]{8,64}$`에 맞아야 한다(claim에서 검사, 틀리면 오류 22023). 앱이 쓰는 소문자 UUID v4(36자)는 통과한다.
- 반환 키 정리: 만료 시각은 `expiresAt`(밀리초), 거절 때 보유자는 `holder`(peer 문자열), renew의 연장 행 수는 `renewed`. claim 성공·renew에는 `holder`가 없고, renew에는 `machine`·`until`이 없다.

- `saebyeok_claim`은 한 문장(원자적)으로 처리한다. 그 세탁기에 살아 있는 임대가 없거나(만료 시각 ≤ 지금) 보유자가 같은 peer이면서 같은 회원이면 보유자를 이 peer·회원으로 바꾸고 `until = min(p_until, 지금+10분)`, 임대 만료 = 지금+45초로 정한 뒤 `ok:true`. 같은 peer가 같은 방에서 다른 세탁기를 갖고 있었으면 같은 트랜잭션에서 그 임대를 지운다(한 peer당 세탁기 하나). 아니면 아무것도 바꾸지 않고 `ok:false`와 현재 보유 정보를 준다. `p_room`이 `laundry`가 아니거나 `p_machine`이 범위를 벗어나면 오류.
- `saebyeok_release`: 이 방에서 이 peer와 호출 회원이 가진 임대를 모두 지운다. 지울 것이 없어도 `ok:true`.
- `saebyeok_renew`: 이 방에서 이 peer와 호출 회원이 가진 임대 행의 만료를 지금+45초로 늘린다. 만료 시각이 지났어도 아직 다른 사람이 가져가지 않은 자기 행이면 연장한다(만료 여부를 따로 검사하지 않음). 행이 없으면(다른 사람이 가져갔거나 반납됨) `ok:false`.

앱 쪽 동작:

- `m ≥ 0`인 상태를 보낼 때, 확인된 보유 세탁기와 번호가 다르거나 `mu`가 바뀌었으면 broadcast 전에 `saebyeok_claim`. `ok:true`면 그대로 보낸다. `ok:false`면 `m·ms·mu`를 직전 확인 상태(없으면 `-1·0·0`)로 되돌려 `onCorrection({accepted:false, requested, presence, reason:'occupied'})`을 부르고, 되돌린 상태를 보낸다. RPC 오류면 보내지 않고 `presence()`를 reject한다.
- `m = -1`(또는 `in = 0`)로 바뀌면 `saebyeok_release`. 실패해도 진행한다(임대는 45초 뒤 저절로 풀린다).
- 보유 중이고 연결돼 있는 동안 15초마다 `saebyeok_renew`. `ok:false`면 보유를 잃은 것으로 보고 `m=-1`로 `onCorrection`을 부른다.
- 연결이 끊기면 보유 확인을 잊고 갱신을 멈춘다. 재연결 뒤 엔진이 상태를 다시 보내면 claim부터 다시 한다. 페이지를 닫을 때(`pagehide`) 보유 중이면 `saebyeok_release`를 한 번 시도하고 `untrack` 뒤 채널을 제거한다.

### 6. 검증

`tests/lodestar-adapter.test.js`가 가짜 Supabase 클라이언트로 위 계약(채널 옵션, snapshot·join·leave 대응, broadcast 형식, 잘못된 payload·초과 수신 폐기, claim·release·renew와 보정, 재연결과 토큰 갱신, 401 뒤 중단)을 확인한다. `tests/build.test.js`는 두 빌드 산출물에서 절대 `/auth/` 경로, JWT 모양 문자열, 프로젝트 Supabase 호스트, 로컬 경로가 없는지 검사한다. 실제 Supabase·로드스타 연동은 로드스타 쪽 적용 뒤 별도로 확인한다.
