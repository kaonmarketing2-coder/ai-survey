"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  SECTIONS,
  ALL_QUESTIONS,
  PROFILE_BREAKDOWN,
  type Question,
} from "@/lib/survey";
import { supabase, ADMIN_RPC } from "@/lib/supabase";

interface Row {
  id: string;
  created_at: string;
  respondent: Record<string, string>;
  answers: Record<string, any>;
}

const PASS_KEY = "ai_survey_admin_pass";

// 정렬 기준(수준/목표) — 단일선택 문항의 선택지 순번으로 수준을 계산
const SORT_OPTIONS = [
  { key: "q14", label: "수준 (Q14 난이도 진단)" },
  { key: "q5", label: "AI 업무 활용 (Q5)" },
  { key: "q1", label: "AI 사용 빈도 (Q1)" },
  { key: "q7", label: "Agent 인식 (Q8)" },
  { key: "name", label: "이름" },
  { key: "created", label: "제출 시각" },
];

function qById(id: string): Question | undefined {
  return ALL_QUESTIONS.find((q) => q.id === id);
}

// 단일선택 답변의 순번(1부터). 못 찾으면 0.
function optIndex(qid: string, answer: unknown): number {
  const q = qById(qid);
  if (!q || !q.options || typeof answer !== "string") return 0;
  const i = q.options.indexOf(answer);
  return i < 0 ? 0 : i + 1;
}

export default function ResultsPage() {
  const [pass, setPass] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRows = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc(ADMIN_RPC, { passcode: code });
    if (error) {
      setAuthed(false);
      setRows(null);
      if (typeof window !== "undefined") sessionStorage.removeItem(PASS_KEY);
      setError(
        /unauthorized/i.test(error.message)
          ? "암호가 올바르지 않습니다."
          : "결과를 불러오지 못했습니다. (" + error.message + ")"
      );
    } else {
      setRows((data as Row[]) || []);
      setAuthed(true);
      if (typeof window !== "undefined") sessionStorage.setItem(PASS_KEY, code);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem(PASS_KEY);
    if (saved) {
      setPass(saved);
      fetchRows(saved);
    }
  }, [fetchRows]);

  function logout() {
    if (typeof window !== "undefined") sessionStorage.removeItem(PASS_KEY);
    setAuthed(false);
    setRows(null);
    setPass("");
  }

  // ---- 잠금 화면 ----
  if (!authed) {
    return (
      <main className="page">
        <div className="topbar">
          <div className="brand">
            <span className="dot">AI</span>
            <span>집계 결과 · 관리자</span>
          </div>
          <Link className="navlink" href="/">
            ← 설문으로
          </Link>
        </div>
        <div className="gate">
          <div className="gate-icon">🔒</div>
          <h2>관리자 전용 페이지</h2>
          <p className="muted">집계 결과와 응답자 명단은 관리자 암호가 필요합니다.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pass.trim()) fetchRows(pass.trim());
            }}
          >
            <input
              type="password"
              placeholder="관리자 암호"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
            />
            <button className="btn" type="submit" disabled={loading || !pass.trim()}>
              {loading ? "확인 중…" : "열기"}
            </button>
          </form>
          {error && <div className="err-banner" style={{ marginTop: 14 }}>{error}</div>}
        </div>
      </main>
    );
  }

  // ---- 대시보드 ----
  return <Dashboard rows={rows || []} onRefresh={() => fetchRows(pass)} onLogout={logout} />;
}

function Dashboard({
  rows,
  onRefresh,
  onLogout,
}: {
  rows: Row[];
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const total = rows.length;
  const [sortKey, setSortKey] = useState("q14");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expFilter, setExpFilter] = useState<string>(""); // Q13 기대 항목 필터

  const q12 = qById("q12");

  const roster = useMemo(() => {
    let list = [...rows];
    if (expFilter) {
      list = list.filter((r) => {
        const v = r.answers?.q12;
        return Array.isArray(v) && v.includes(expFilter);
      });
    }
    list.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "name") {
        av = a.respondent?.name || "";
        bv = b.respondent?.name || "";
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv), "ko")
          : String(bv).localeCompare(String(av), "ko");
      } else if (sortKey === "created") {
        av = new Date(a.created_at).getTime();
        bv = new Date(b.created_at).getTime();
      } else {
        av = optIndex(sortKey, a.answers?.[sortKey]);
        bv = optIndex(sortKey, b.answers?.[sortKey]);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [rows, sortKey, sortDir, expFilter]);

  function downloadCsv() {
    const cols = ["제출시각", "이름", "소속", "직급"];
    const qCols = ALL_QUESTIONS.filter(
      (q) => !["org", "job", "rank", "name"].includes(q.id)
    );
    for (const q of qCols) cols.push(`${q.no || ""} ${stripHint(q.label)}`.trim());

    const esc = (s: string) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
    const lines = [cols.map(esc).join(",")];

    for (const r of rows) {
      const cells: string[] = [
        fmtDate(r.created_at),
        r.respondent?.name || "",
        r.respondent?.org || "",
        r.respondent?.rank || "",
      ];
      for (const q of qCols) {
        const v = r.answers?.[q.id];
        let cell = "";
        if (Array.isArray(v)) cell = v.join(" | ");
        else if (typeof v === "string") cell = v;
        const other = r.answers?.[`${q.id}__other`];
        if (other) cell += (cell ? " | " : "") + "기타: " + other;
        cells.push(cell);
      }
      lines.push(cells.map(esc).join(","));
    }

    const csv = "﻿" + lines.join("\r\n"); // BOM: 엑셀 한글 깨짐 방지
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-survey-responses-${total}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page">
      <div className="topbar">
        <div className="brand">
          <span className="dot">AI</span>
          <span>집계 결과 · 관리자</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="refresh" onClick={onRefresh}>
            ⟳ 새로고침
          </button>
          <button className="refresh" onClick={onLogout}>
            로그아웃
          </button>
          <Link className="navlink" href="/">
            ← 설문으로
          </Link>
        </div>
      </div>

      <div className="hero">
        <h1>AI 활용 수준 사전 진단 — 집계</h1>
        <p>제출된 응답을 실시간으로 집계합니다. 응답자별 명단은 분반 배정을 위해 이름과 함께 표시됩니다.</p>
      </div>

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
          <div className="num">{total ? fmtDate(latest(rows)) : "-"}</div>
          <div className="cap">최근 응답</div>
        </div>
      </div>

      {total === 0 && (
        <div className="section center muted">아직 제출된 응답이 없습니다.</div>
      )}

      {total > 0 && (
        <>
          {/* 응답자별 명단 (분반 배정용) */}
          <section className="section">
            <div className="roster-head">
              <h2 style={{ margin: 0 }}>응답자별 명단</h2>
              <button className="btn secondary csv-btn" onClick={downloadCsv}>
                ⬇ CSV 다운로드
              </button>
            </div>
            <div className="rule" />

            <div className="controls">
              <div className="ctrl">
                <label>정렬 기준</label>
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ctrl">
                <label>방향</label>
                <button
                  className="refresh"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  {sortDir === "asc" ? "오름차순 ↑" : "내림차순 ↓"}
                </button>
              </div>
            </div>

            <div className="chips">
              <span className="chips-label">기대(Q13) 필터:</span>
              <button
                className={`chip${expFilter === "" ? " on" : ""}`}
                onClick={() => setExpFilter("")}
              >
                전체
              </button>
              {q12?.options?.map((o) => (
                <button
                  key={o}
                  className={`chip${expFilter === o ? " on" : ""}`}
                  onClick={() => setExpFilter(o)}
                >
                  {o}
                </button>
              ))}
            </div>

            <div className="muted small" style={{ margin: "6px 0 10px" }}>
              {roster.length}명 표시 중 {expFilter && `· "${expFilter}" 선택자`}
            </div>

            <div className="table-wrap">
              <table className="roster">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>소속</th>
                    <th>직무</th>
                    <th>직급</th>
                    <th title="Q14 난이도 진단">수준</th>
                    <th title="Q5 AI 업무 활용">활용</th>
                    <th>기대 (Q13)</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr key={r.id}>
                      <td className="nm">{r.respondent?.name || "-"}</td>
                      <td>{r.respondent?.org || "-"}</td>
                      <td>{r.respondent?.job || "-"}</td>
                      <td>{r.respondent?.rank || "-"}</td>
                      <td className="lv">
                        <LevelBadge qid="q14" answer={r.answers?.q14} />
                      </td>
                      <td className="lv">
                        <LevelBadge qid="q5" answer={r.answers?.q5} />
                      </td>
                      <td>
                        <div className="tags">
                          {Array.isArray(r.answers?.q12) && r.answers.q12.length ? (
                            r.answers.q12.map((t: string) => (
                              <span className="tag" key={t}>
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="muted small">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

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
    </main>
  );
}

function LevelBadge({ qid, answer }: { qid: string; answer: unknown }) {
  const idx = optIndex(qid, answer);
  if (!idx) return <span className="muted">-</span>;
  return (
    <span className="lv-badge" title={typeof answer === "string" ? answer : ""}>
      {idx}
    </span>
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

      {(q.type === "text" || q.type === "textarea") && <FreeTexts rows={rows} qid={q.id} />}
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
        <button className="refresh" style={{ marginTop: 8 }} onClick={() => setOpen((o) => !o)}>
          {open ? "접기" : `+ ${texts.length - 5}개 더 보기`}
        </button>
      )}
    </div>
  );
}

/* ---------- 집계 헬퍼 ---------- */

function stripHint(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

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
  return (q.options || []).map((o) => ({ label: o, count: counts.get(o) || 0 }));
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

function latest(rows: Row[]): string {
  return rows.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b
  ).created_at;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}
