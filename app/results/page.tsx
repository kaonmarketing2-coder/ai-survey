"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  SECTIONS,
  ALL_QUESTIONS,
  PROFILE_BREAKDOWN,
  type Question,
} from "@/lib/survey";
import { supabase, PUBLIC_VIEW } from "@/lib/supabase";

interface Row {
  id: string;
  created_at: string;
  respondent: Record<string, string>;
  answers: Record<string, any>;
}

export default function ResultsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from(PUBLIC_VIEW)
      .select("id, created_at, respondent, answers")
      .order("created_at", { ascending: false });
    if (error) {
      setError("결과를 불러오지 못했습니다. (" + error.message + ")");
      setRows(null);
    } else {
      setRows((data as Row[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = rows?.length ?? 0;

  return (
    <main className="page">
      <div className="topbar">
        <div className="brand">
          <span className="dot">AI</span>
          <span>집계 결과</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="refresh" onClick={load}>
            ⟳ 새로고침
          </button>
          <Link className="navlink" href="/">
            ← 설문으로
          </Link>
        </div>
      </div>

      <div className="hero">
        <h1>AI 활용 수준 사전 진단 — 집계</h1>
        <p>제출된 응답을 실시간으로 집계합니다. 개인정보 보호를 위해 이름은 집계에서 제외됩니다.</p>
      </div>

      {loading && !rows && <div className="spin" />}
      {error && <div className="err-banner">{error}</div>}

      {rows && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="num">{total}</div>
              <div className="cap">총 응답 수</div>
            </div>
            <div className="stat">
              <div className="num">{distinctCount(rows, "org")}</div>
              <div className="cap">응답 소속 수</div>
            </div>
            <div className="stat">
              <div className="num">{lastUpdated(rows)}</div>
              <div className="cap">최근 응답</div>
            </div>
          </div>

          {total === 0 && (
            <div className="section center muted">
              아직 제출된 응답이 없습니다. 첫 응답을 기다리는 중입니다.
            </div>
          )}

          {total > 0 && (
            <>
              {/* 응답자 분포 */}
              <section className="section">
                <h2>응답자 분포</h2>
                <div className="rule" />
                {PROFILE_BREAKDOWN.map((p) => (
                  <div className="q" key={p.id}>
                    <div className="q-head">
                      <div className="q-label">
                        <span>{p.label}별</span>
                      </div>
                    </div>
                    <Bars data={profileDist(rows, p.id)} total={total} alt />
                  </div>
                ))}
              </section>

              {/* 문항별 집계 */}
              {SECTIONS.filter((s) => s.id !== "profile").map((sec) => (
                <section className="section" key={sec.id}>
                  <h2>{sec.title}</h2>
                  <div className="rule" />
                  {sec.questions.map((q) => (
                    <ResultBlock key={q.id} q={q} rows={rows} total={total} />
                  ))}
                </section>
              ))}
            </>
          )}
        </>
      )}
    </main>
  );
}

function ResultBlock({ q, rows, total }: { q: Question; rows: Row[]; total: number }) {
  return (
    <div className="q" id={`r-${q.id}`}>
      <div className="q-head">
        <div className="q-label">
          {q.no && <span className="q-no">{q.no}</span>}
          <span>{q.label}</span>
        </div>
        {q.type === "multi" && <div className="q-hint">복수응답 · % 는 전체 응답자 기준</div>}
      </div>

      {(q.type === "single" || q.type === "multi") && (
        <>
          <Bars data={choiceDist(rows, q)} total={total} />
          {q.hasOther && <OtherTexts rows={rows} qid={q.id} />}
        </>
      )}

      {(q.type === "text" || q.type === "textarea") && (
        <FreeTexts rows={rows} qid={q.id} />
      )}
    </div>
  );
}

function Bars({
  data,
  total,
  alt,
}: {
  data: { label: string; count: number }[];
  total: number;
  alt?: boolean;
}) {
  if (data.length === 0) return <div className="muted small">응답 없음</div>;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      {data.map((d) => {
        const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
        return (
          <div className="bar-row" key={d.label}>
            <div className="bar-top">
              <span>{d.label}</span>
              <span className="val">
                {d.count}명 · {pct}%
              </span>
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill${alt ? " alt" : ""}`}
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FreeTexts({ rows, qid }: { rows: Row[]; qid: string }) {
  const texts = rows
    .map((r) => (typeof r.answers?.[qid] === "string" ? r.answers[qid].trim() : ""))
    .filter((t) => t !== "");
  return <TextList texts={texts} />;
}

function OtherTexts({ rows, qid }: { rows: Row[]; qid: string }) {
  const texts = rows
    .map((r) => {
      const t = r.answers?.[`${qid}__other`];
      return typeof t === "string" ? t.trim() : "";
    })
    .filter((t) => t !== "");
  if (texts.length === 0) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div className="field-label small">기타 응답</div>
      <TextList texts={texts} />
    </div>
  );
}

function TextList({ texts }: { texts: string[] }) {
  const [open, setOpen] = useState(false);
  if (texts.length === 0) return <div className="muted small">응답 없음</div>;
  const shown = open ? texts : texts.slice(0, 5);
  return (
    <div>
      <div className="texts">
        {shown.map((t, i) => (
          <div className="text-item" key={i}>
            {t}
          </div>
        ))}
      </div>
      {texts.length > 5 && (
        <button
          className="refresh"
          style={{ marginTop: 8 }}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "접기" : `+ ${texts.length - 5}개 더 보기`}
        </button>
      )}
    </div>
  );
}

/* ---------- 집계 헬퍼 ---------- */

function choiceDist(rows: Row[], q: Question): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  (q.options || []).forEach((o) => counts.set(o, 0));
  for (const r of rows) {
    const v = r.answers?.[q.id];
    if (q.type === "single") {
      if (typeof v === "string" && counts.has(v)) counts.set(v, counts.get(v)! + 1);
    } else if (Array.isArray(v)) {
      for (const opt of v) {
        if (counts.has(opt)) counts.set(opt, counts.get(opt)! + 1);
      }
    }
  }
  return (q.options || [])
    .map((o) => ({ label: o, count: counts.get(o) || 0 }))
    .filter((d) => d.count > 0 || true); // 모든 선택지 표시(0 포함)
}

function profileDist(rows: Row[], key: string): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const raw = (r.respondent?.[key] || "").trim() || "(미기재)";
    counts.set(raw, (counts.get(raw) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function distinctCount(rows: Row[], key: string): number {
  const s = new Set<string>();
  for (const r of rows) {
    const v = (r.respondent?.[key] || "").trim();
    if (v) s.add(v);
  }
  return s.size;
}

function lastUpdated(rows: Row[]): string {
  if (rows.length === 0) return "-";
  const latest = rows.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b
  );
  const d = new Date(latest.created_at);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}
