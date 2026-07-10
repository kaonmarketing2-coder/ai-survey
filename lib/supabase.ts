import { createClient } from "@supabase/supabase-js";

// Supabase 프로젝트: ai-survey
// anon 키는 브라우저에 노출되도록 설계된 공개 키입니다. 데이터 보호는
// Row Level Security(익명 INSERT 허용 / 이름 제외 공개 뷰 SELECT)로 처리합니다.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://delztisxirqzcrnqhshu.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbHp0aXN4aXJxemNybnFoc2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NTEyMjcsImV4cCI6MjA5OTIyNzIyN30.hDmMd2iai7rKkYdZJRVb5rkoeKakDdJCV0IuZyepB-k";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export const TABLE = "survey_responses";
// 결과 조회는 관리자 암호가 필요한 보안 함수로만 가능합니다.
export const ADMIN_RPC = "get_admin_responses";
