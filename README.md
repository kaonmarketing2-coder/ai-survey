# AI 활용 수준 사전 진단 Survey

교육 설계를 위한 **AI 활용 수준 사전 진단 설문**과, 제출된 응답을 **실시간으로 집계**해 보여주는 결과 페이지입니다.

## 화면

- `/` — 설문 폼 (9개 섹션 · 기본 정보 + Q1~Q15)
- `/results` — 집계 결과 (문항별 막대그래프, 주관식 응답 목록, 응답자 분포)

## 기술 스택

- **Next.js 14** (App Router) + TypeScript
- **Supabase** (PostgreSQL) — 응답 저장 및 집계
- 배포: **Vercel**

## 데이터 구조

`public.survey_responses` 테이블 (1행 = 1응답)

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | PK |
| `created_at` | timestamptz | 제출 시각 |
| `respondent` | jsonb | 소속 / 직무 / 직급 / 이름(선택) |
| `answers` | jsonb | `q1`~`q15` 응답, 복수선택은 배열, 기타 입력은 `q{n}__other` |

### 개인정보 보호 (RLS)

- 익명 사용자는 **INSERT만** 가능 (응답 제출)
- 결과 조회는 이름을 제거한 공개 뷰 `public.survey_public` 를 통해서만 가능
- 원본 테이블(이름 포함)은 익명 사용자가 직접 조회할 수 없음

## 설문 정의

모든 문항은 `lib/survey.ts` 한 곳에서 정의합니다. 이 파일이 **폼 렌더링과 결과 집계의 단일 소스**이므로, 문항을 추가·수정하려면 이 파일만 고치면 됩니다.

문항 유형:

- `single` — 단일선택 (라디오)
- `multi` — 복수선택 (체크박스, 일부는 "기타" 자유 입력 지원)
- `text` / `textarea` — 주관식

## 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

환경변수(선택). 미설정 시 코드에 포함된 공개 anon 키로 동작합니다.

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

> Supabase anon 키는 브라우저에 노출되도록 설계된 **공개 키**이며, 데이터 보호는 RLS 정책으로 처리됩니다.
