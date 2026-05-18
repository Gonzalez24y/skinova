# Skinova - AI 피부 진단 앱

AI로 피부 상태를 분석하고 맞춤 스킨케어 조언을 제공하는 모바일 앱.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API 서버 실행 (포트 8080)
- `pnpm --filter @workspace/mobile run dev` — Expo 모바일 앱 실행
- `pnpm run typecheck` — 전체 타입 검사

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + multer (이미지 업로드)
- AI: OpenAI GPT-4o Vision
- Mobile: Expo (React Native) + expo-router + expo-image-picker
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/routes/skin.ts` — 피부 분석 API (`POST /api/skin/analyze`)
- `artifacts/mobile/app/index.tsx` — 메인 화면 (랜딩 → 증상 선택 → 로딩 → 결과)
- `artifacts/mobile/constants/colors.ts` — 테마 컬러 (테라코타 팔레트)
- `artifacts/mobile/eas.json` — EAS APK 빌드 설정
- `artifacts/api-server/.env.example` — API 서버 환경변수 예시
- `artifacts/mobile/.env.example` — 모바일 앱 환경변수 예시

## Architecture decisions

- OpenAI API를 백엔드에서 호출 (API 키 노출 방지)
- multer로 이미지를 메모리 버퍼로 받아 base64로 변환 후 GPT에 전달
- Expo 모바일 앱은 카메라/갤러리로 피부 사진 촬영 후 API 서버로 전송
- 증상 선택(여드름/트러블/건조함/기타)을 AI 프롬프트에 포함해 정확도 향상

## Product

- 랜딩: 카메라 촬영 또는 갤러리에서 사진 선택
- 증상 선택: 여드름, 트러블, 건조함, 기타 중 복수 선택
- AI 분석: GPT-4o Vision으로 피부 상태 분석
- 결과: 추정 질환명, 심각도(1-5), 설명, 관리법 3가지, 병원 방문 여부

## Replit 외부에서 실행하기

### API 서버

```bash
cd artifacts/api-server
cp .env.example .env
# .env에 OPENAI_API_KEY 입력
pnpm install
pnpm run dev
```

### 모바일 앱 (개발 서버)

```bash
cd artifacts/mobile
cp .env.example .env
# .env에 EXPO_PUBLIC_API_URL=http://서버IP:8080 입력
pnpm install
pnpm exec expo start
```

## APK 빌드 방법

EAS Build를 사용합니다 (Expo 계정 필요):

```bash
# 1. eas-cli 설치
npm install -g eas-cli

# 2. Expo 계정 로그인
eas login

# 3. eas.json의 preview.env.EXPO_PUBLIC_API_URL을 실제 서버 주소로 수정

# 4. APK 빌드 (클라우드 빌드, 약 10~15분 소요)
cd artifacts/mobile
eas build --platform android --profile preview

# 5. 빌드 완료 후 다운로드 링크 제공됨
```

빌드 프로필 설명:
- `preview` — APK 파일 생성 (테스트/배포용)
- `production` — AAB 파일 생성 (구글 플레이 스토어 배포용)
- `development` — 개발 클라이언트 APK

## Environment Variables

### API 서버 (`artifacts/api-server/.env`)

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `OPENAI_API_KEY` | OpenAI API 키 | Replit 외부에서 필수 |
| `OPENAI_MODEL` | GPT 모델명 (기본: gpt-4o) | 선택 |
| `PORT` | 서버 포트 (기본: 8080) | 선택 |

> Replit에서는 `AI_INTEGRATIONS_OPENAI_BASE_URL` / `AI_INTEGRATIONS_OPENAI_API_KEY` 자동 설정됨

### 모바일 앱 (`artifacts/mobile/.env`)

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `EXPO_PUBLIC_API_URL` | API 서버 주소 | Replit 외부에서 필수 |

> Replit에서는 `EXPO_PUBLIC_DOMAIN` 자동 설정됨

## User preferences

- 한국어 UI
- 원본 프로젝트(skinova-app)의 기능을 Expo 모바일로 이식

## Gotchas

- expo-image-picker는 app.json의 plugins에 등록 필요
- API 서버는 multer로 이미지 수신, 20MB 제한
- EAS 빌드 전 eas.json의 EXPO_PUBLIC_API_URL을 실제 배포된 API 서버 주소로 변경 필요
- Android 패키지명: com.skinova.app
