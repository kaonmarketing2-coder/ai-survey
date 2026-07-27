import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Supabase 무료 티어의 비활성 자동 일시정지 방지용 keep-alive.
// vercel.json 의 cron 이 매일 이 엔드포인트를 호출해 DB에 가벼운 조회를 보낸다.
export async function GET() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://delztisxirqzcrnqhshu.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbHp0aXN4aXJxemNybnFoc2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NTEyMjcsImV4cCI6MjA5OTIyNzIyN30.hDmMd2iai7rKkYdZJRVb5rkoeKakDdJCV0IuZyepB-k";

  try {
    const res = await fetch(`${url}/rest/v1/survey_responses?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      at: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "fetch failed", at: new Date().toISOString() },
      { status: 500 }
    );
  }
}
