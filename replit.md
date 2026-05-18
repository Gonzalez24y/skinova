# Skinova - AI 피부 진단 앱

AI로 피부 상태를 분석하고 맞춤 스킨케어 조언을 제공하는 모바일 앱.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API 서버 실행 (포트 8080)
- `pnpm --filter @workspace/mobile run dev` — Expo 모바일 앱 실행
- `pnpm run typecheck` — 전체 타입 검사
- `pnpm run build` — 전체 빌드

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + multer (이미지 업로드)
- AI: OpenAI GPT Vision (Replit AI Integrations 프록시)
- Mobile: Expo (React Native) + expo-router + expo-image-picker
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/routes/skin.ts` — 피부 분석 API 엔드포인트 (`POST /api/skin/analyze`)
- `artifacts/mobile/app/index.tsx` — 메인 화면 (랜딩 → 증상 선택 → 로딩 → 결과)
- `artifacts/mobile/constants/colors.ts` — 테마 컬러 (테라코타 팔레트)

## Architecture decisions

- OpenAI GPT Vision API를 백엔드에서 호출 (API 키 노출 방지)
- multer로 이미지를 메모리 버퍼로 받아 base64로 변환 후 GPT에 전달
- Expo 모바일 앱은 카메라/갤러리로 피부 사진 촬영 후 API 서버로 전송
- 증상 선택(여드름/트러블/건조함/기타)을 AI 프롬프트에 포함해 정확도 향상

## Product

- 랜딩: 카메라 촬영 또는 갤러리에서 사진 선택
- 증상 선택: 여드름, 트러블, 건조함, 기타 중 복수 선택
- AI 분석: GPT-4o Vision으로 피부 상태 분석
- 결과: 추정 질환명, 심각도(1-5), 설명, 관리법 3가지, 병원 방문 여부

## 참고 프로젝트

- GitHub: https://github.com/Gonzalez24y/skinova-app (Next.js 웹 버전)
- 동일한 AI 분석 로직을 Expo 모바일로 이식

## User preferences

- 한국어 UI
- 원본 프로젝트(skinova-app)의 기능을 Expo 모바일로 이식

## Gotchas

- AI_INTEGRATIONS_OPENAI_BASE_URL, AI_INTEGRATIONS_OPENAI_API_KEY는 Replit AI Integrations가 자동 설정
- expo-image-picker는 app.json의 plugins에 등록 필요
- API 서버는 multer로 이미지 수신, 20MB 제한
