# 새벽빨래방 · 따순물 찜질스파

개발자: 홍서진 · 라이선스: [MIT](LICENSE)

새벽빨래방은 여러 사람이 같은 3D 공간에 익명으로 머무는 작은 웹앱입니다. 불 켜진 새벽 빨래방(세탁기 4대)과 따순물 찜질스파, 두 장면이 있습니다. 들어오면 무작위 닉네임과 외형이 정해지고, 다른 손님의 위치·자세·세탁기 사용이 실시간으로 보입니다. 같은 세탁기는 한 사람만 쓸 수 있습니다.

상태: 프로토타입입니다. 장면과 엔진은 Claude 아티팩트로 만든 원본 프로토타입에서 가져왔고, 이 저장소는 그 장면을 독립 웹앱(PWA)으로 실행하는 틀, 실시간 전송, 로그인 연동을 더했습니다.

## 실행

Node.js 22 이상과 npm이 필요합니다.

```sh
npm ci
npm run dev
```

- 빨래방: http://127.0.0.1:5173/saebyeok-laundry.html
- 스파: http://127.0.0.1:5173/ttasun-spa.html
- 다른 브라우저 창을 하나 더 열면 서로의 아바타가 보입니다.

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 기본 빌드 후 로컬 서버 실행(정적 파일 + `/realtime` WebSocket) |
| `npm run build` | 로컬 서버용 빌드(`BACKEND=local`)를 `dist/`에 만든다 |
| `npm run build:lodestar` | 로드스타 호스팅용 빌드(`BACKEND=lodestar`, `BASE=/apps/saebyeok/`) |
| `npm test` | 단위·계약·통합 테스트(먼저 `npm run build`) |
| `npm run test:e2e` | Playwright가 이미 설치돼 있을 때만 두 브라우저 접속 확인. 없으면 SKIP, 자동 설치하지 않음 |

`dev`는 시작할 때 한 번 빌드합니다. 파일을 고친 뒤 다시 실행하세요. 포트는 `PORT`, 바인딩 주소는 `HOST`로 바꿉니다. 기본은 localhost이며 공개 서버용이 아닙니다. 같은 LAN의 휴대폰에서 보려면 `HOST=0.0.0.0 npm run dev` 후 PC의 LAN 주소를 엽니다. PWA 설치·서비스 워커는 HTTPS 또는 localhost에서만 동작합니다.

## 실시간 전송과 로그인

엔진은 `window.Realtime` 어댑터 하나만 봅니다. 전송은 빌드 설정으로 고릅니다. 자세한 형식은 [어댑터 계약](docs/realtime-adapter.md)에 있습니다.

- **local-ws**(기본): 같은 출처 WebSocket. 서버가 입력을 검증하고 세탁기 점유를 먼저 온 순서로 중재합니다. 방 상태는 메모리에만 두고 저장하지 않습니다.
- **lodestar**: 로드스타 서버의 `/apps/saebyeok/` 아래에서 서빙되는 판입니다. 로드스타 로그인 세션을 그대로 쓰고, Supabase Realtime 비공개 채널(Presence·Broadcast)과 점유 RPC로 동작합니다. Supabase 주소·키·토큰은 저장소와 빌드에 들어가지 않고 실행 중에 세션 API로 받습니다.
- Claude room: 원본처럼 `window.claude.use`가 있는 호스트에서는 그 기능을 그대로 씁니다.

로컬 서버에서도 로드스타 계정 로그인(OAuth, 선택)을 켤 수 있습니다. [로그인 설계와 설정](docs/lodestar-login.md)을 보고 `.env.example`을 `.env`로 복사해 값을 채운 뒤 실행합니다. `.env`는 Git에서 제외되며 자동으로 읽지 않습니다.

```sh
npm run build
node --env-file=.env server/index.js
```

`AUTH_REQUIRED=1`이면 로그인하지 않은 WebSocket을 거절하고 입장 버튼을 잠급니다. 설정이 빠져도 익명 허용으로 바뀌지 않습니다. 기본값 `AUTH_REQUIRED=0`은 익명 입장입니다. 로그인 신원은 장면 속 익명 닉네임과 별개입니다.

## 구조

```text

src/engine.js         원본 공용 엔진(실시간 연결 부분만 어댑터 경계로 교체)
src/laundry.js        원본 빨래방 장면
src/spa.js            원본 스파 장면
src/shell.html        화면 틀 + 개발자 표기·로그인 상태·PWA·고지 링크
src/realtime/         validate.js(공용 검증) · adapter.js(Claude room / local-ws / lodestar)
src/auth/             로그인 상태·입장 정책(로컬 BFF / 로드스타 세션)
server/               로컬 HTTP 정적 서버 + 방별 WebSocket 중계·점유 중재 + 로그인 BFF
scripts/              빌드, 선택적 e2e, 아이콘 생성·검증
tests/                서버·인증·어댑터 계약·서비스 워커·빌드 산출물 검사
public/               manifest 2개 · 서비스 워커 · 오픈소스 고지 · 아이콘
licenses/             외부 라이선스 전문
docs/                 어댑터 계약 · 로그인 설계 · 원본 SHA-256
```

## 모바일

원본의 탭 이동, 터치 행동 버튼, `touch-action:manipulation`, safe-area 여백, 화면 크기 대응을 그대로 씁니다. 홈 화면 아이콘(PWA·iOS)과 공유 이미지는 `public/icons/`에 있습니다([아이콘 설명](public/icons/README)). iOS 실기기 설치·WebGL·오디오는 아직 검증하지 않았습니다.

## 라이선스와 고지

- 이 저장소의 코드: [MIT License](LICENSE), 저작권자 홍서진
- Three.js r128(npm `three` 0.128.0): MIT, 빌드 때 `vendor/three.min.js`로 앱에 동봉합니다. 전문 [licenses/THREE-MIT.txt](licenses/THREE-MIT.txt)
- 글꼴 Jua · Noto Sans KR: SIL Open Font License 1.1, Google Fonts CSS로만 불러오고 글꼴 파일은 동봉하지 않습니다. 전문 [licenses/Jua-OFL.txt](licenses/Jua-OFL.txt), [licenses/NotoSansKR-OFL.txt](licenses/NotoSansKR-OFL.txt)
- ws(로컬 서버), @supabase/supabase-js(lodestar 빌드): MIT. 전문은 [licenses/](licenses/README.md)
- 앱 안에서는 입장 화면의 "오픈소스 고지" 링크([public/licenses.html](public/licenses.html))로 같은 내용을 볼 수 있습니다.

Three.js는 고정 버전 npm 패키지(`three` 0.128.0, 원본 CDN r128 파일과 바이트 단위로 같음)를 빌드 때 `vendor/three.min.js`로 복사해 같은 출처에서 불러옵니다. Google Fonts만 원본과 같은 CDN 주소를 쓰며, 이 주소는 글꼴 버전을 고정하지 않습니다. 서비스 워커는 외부 글꼴을 캐시하지 않으므로 오프라인 실행은 지원하지 않습니다.

## 남은 일

- 로드스타 쪽 적용(점유 RPC·채널 권한·세션 API·정적 반입) 뒤 실기기 두 대로 연동 확인
- 글꼴 버전 고정, iOS 실기기 확인
