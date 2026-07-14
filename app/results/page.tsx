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
import { DIVISIONS, orgDivision } from "@/lib/orgs";

interface Row {
  id: string;
  created_at: string;
  respondent: Record<string, string>;
  answers: Record<string, any>;
}

const PASS_KEY = "ai_survey_admin_pass";

// 정렬 기준(수준/목표) — 단일선택 문항의 선택지 순번으로 수준을 계산
const SORT_OPTIONS = [
  { key: "score", label: "종합 점수" },
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

/* ---------- 종합 점수 (0~100) ----------
   자가진단 Q14 40% + 활용 Q5 20% + 빈도 Q1 10%
   + 인식 Q8·Q9 각 5% + 고급 기능 실경험(Q3·Q6) 20%          */

// 고급 경험으로 인정하는 항목 (Q3 기능 경험 / Q6 경험 항목)
const ADV_Q3 = ["MCP(Server) 연결", "Claude Code", "Agent 생성", "API 활용"];
const ADV_Q6 = [
  "반복되는 업무를 AI로 자동화",
  "Python을 이용한 AI 활용",
  "Claude Code 활용",
  "MCP 활용",
  "Agent 제작",
  "API 연동",
];

// 선택지 순번을 0~1로 정규화
function norm(qid: string, answer: unknown): number {
  const q = qById(qid);
  const n = q?.options?.length || 0;
  const i = optIndex(qid, answer);
  return n > 1 && i > 0 ? (i - 1) / (n - 1) : 0;
}

// 고급 경험 점수: 10개 항목 중 6개 이상이면 만점
function advExp(answers: Record<string, any>): number {
  const a3: string[] = Array.isArray(answers?.q3) ? answers.q3 : [];
  const a6: string[] = Array.isArray(answers?.q6) ? answers.q6 : [];
  const cnt =
    ADV_Q3.filter((o) => a3.includes(o)).length +
    ADV_Q6.filter((o) => a6.includes(o)).length;
  return Math.min(cnt / 6, 1);
}

// gap: 자가진단(Q14)과 나머지 신호의 차이가 0.3 이상이면 분반 검토 표시
function levelScore(r: Row): { score: number; gap: boolean; self: number; others: number } {
  const self = norm("q14", r.answers?.q14);
  const others =
    (norm("q5", r.answers?.q5) * 0.2 +
      norm("q1", r.answers?.q1) * 0.1 +
      norm("q7", r.answers?.q7) * 0.05 +
      norm("q8", r.answers?.q8) * 0.05 +
      advExp(r.answers || {}) * 0.2) /
    0.6;
  const score = Math.round((self * 0.4 + others * 0.6) * 100);
  return { score, gap: Math.abs(self - others) >= 0.3, self, others };
}

// 응답자가 실제 체크한 고급 경험 항목 목록
function advExpList(answers: Record<string, any>): string[] {
  const a3: string[] = Array.isArray(answers?.q3) ? answers.q3 : [];
  const a6: string[] = Array.isArray(answers?.q6) ? answers.q6 : [];
  return [
    ...ADV_Q3.filter((o) => a3.includes(o)),
    ...ADV_Q6.filter((o) => a6.includes(o)),
  ];
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
  const [sortKey, setSortKey] = useState("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expFilter, setExpFilter] = useState<string>(""); // Q13 기대 항목 필터
  const [track, setTrack] = useState<"all" | "A" | "B" | "C">("all");
  const [selected, setSelected] = useState<Row | null>(null); // 개별 응답 보기
  const [scoreDetail, setScoreDetail] = useState<Row | null>(null); // 점수 구성/⚠ 사유 보기

  const q12 = qById("q12");

  // 종합 점수 내림차순 3등분 → Track A(심화) / B(표준) / C(기초)
  const trackMap = useMemo(() => {
    const sorted = [...rows].sort((a, b) => levelScore(b).score - levelScore(a).score);
    const n = sorted.length;
    const aEnd = Math.ceil(n / 3);
    const bEnd = Math.ceil((2 * n) / 3);
    const m = new Map<string, "A" | "B" | "C">();
    sorted.forEach((r, i) => m.set(r.id, i < aEnd ? "A" : i < bEnd ? "B" : "C"));
    return m;
  }, [rows]);

  const trackInfo = useMemo(() => {
    const info = {
      A: { count: 0, min: 101, max: -1 },
      B: { count: 0, min: 101, max: -1 },
      C: { count: 0, min: 101, max: -1 },
    };
    for (const r of rows) {
      const t = trackMap.get(r.id);
      if (!t) continue;
      const s = levelScore(r).score;
      info[t].count++;
      info[t].min = Math.min(info[t].min, s);
      info[t].max = Math.max(info[t].max, s);
    }
    return info;
  }, [rows, trackMap]);

  // 선택된 Track 소속만 (전체 탭이면 전원) — 명단·분포·문항 집계 공통 기준
  const trackRows = useMemo(
    () => (track === "all" ? rows : rows.filter((r) => trackMap.get(r.id) === track)),
    [rows, track, trackMap]
  );
  const tTotal = trackRows.length;

  const roster = useMemo(() => {
    let list = [...rows];
    if (track !== "all") {
      list = list.filter((r) => trackMap.get(r.id) === track);
    }
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
      } else if (sortKey === "score") {
        av = levelScore(a).score;
        bv = levelScore(b).score;
      } else {
        av = optIndex(sortKey, a.answers?.[sortKey]);
        bv = optIndex(sortKey, b.answers?.[sortKey]);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [rows, sortKey, sortDir, expFilter, track, trackMap]);

  function downloadCsv() {
    const cols = ["제출시각", "이름", "소속", "직급", "종합점수", "Track", "점수확인필요"];
    const qCols = ALL_QUESTIONS.filter(
      (q) => !["org", "job", "rank", "name"].includes(q.id)
    );
    for (const q of qCols) cols.push(`${q.no || ""} ${stripHint(q.label)}`.trim());

    const esc = (s: string) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
    const lines = [cols.map(esc).join(",")];

    for (const r of rows) {
      const sc = levelScore(r);
      const cells: string[] = [
        fmtDate(r.created_at),
        r.respondent?.name || "",
        r.respondent?.org || "",
        r.respondent?.rank || "",
        String(sc.score),
        trackMap.get(r.id) || "",
        sc.gap ? "확인" : "",
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

            <div className="tabs">
              <button className={`tab${track === "all" ? " on" : ""}`} onClick={() => setTrack("all")}>
                전체 <span className="tab-n">{total}명</span>
              </button>
              {(["A", "B", "C"] as const).map((t) => {
                const info = trackInfo[t];
                const label = t === "A" ? "심화" : t === "B" ? "표준" : "기초";
                return (
                  <button key={t} className={`tab${track === t ? " on" : ""}`} onClick={() => setTrack(t)}>
                    <span className="tab-t">
                      <i className={`tdot tk-${t}`} />
                      Track {t} · {label}
                    </span>
                    <span className="tab-n">
                      {info.count}명{info.count > 0 && ` · ${info.min}~${info.max}점`}
                    </span>
                  </button>
                );
              })}
            </div>

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
              {roster.length}명 표시 중 {expFilter && `· "${expFilter}" 선택자 `}
              — 종합 점수(0~100) = 자가진단 Q14 40% · 활용 Q5 20% · 빈도 Q1 10% · 인식 Q8+Q9 10% · 고급 경험(Q3·Q6의 MCP/Agent/API/Code/자동화 등) 20%.
              ⚠ = 자가진단과 실제 경험 신호가 크게 어긋나 분반 시 확인 권장.
            </div>

            <div className="table-wrap">
              <table className="roster">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>소속</th>
                    <th>직급</th>
                    <th title="Q14 40% + Q5 20% + Q1 10% + Q8·Q9 10% + 고급 경험(Q3·Q6) 20% → 0~100">점수</th>
                    <th title="Q14 난이도 진단">수준</th>
                    <th title="Q5 AI 업무 활용">활용</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr key={r.id}>
                      <td className="nm">
                        <button className="name-btn" onClick={() => setSelected(r)} title="클릭하면 응답 내역을 볼 수 있습니다">
                          {r.respondent?.name || "-"}
                        </button>
                        {track === "all" && (
                          <span className={`tk-chip tk-${trackMap.get(r.id)}`}>{trackMap.get(r.id)}</span>
                        )}
                      </td>
                      <td className="org" title={r.respondent?.org || ""}>{r.respondent?.org || "-"}</td>
                      <td>{r.respondent?.rank || "-"}</td>
                      <td className="lv">
                        <ScoreBadge r={r} onClick={() => setScoreDetail(r)} />
                      </td>
                      <td className="lv">
                        <LevelBadge qid="q14" answer={r.answers?.q14} />
                      </td>
                      <td className="lv">
                        <LevelBadge qid="q5" answer={r.answers?.q5} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {track !== "all" && (
            <div className="scope-note">
              아래 분포와 문항별 집계는 <b>Track {track} 소속 {tTotal}명</b> 기준입니다. 전체 기준으로 보려면 [전체] 탭을 선택하세요.
            </div>
          )}

          {/* 응답자 분포 */}
          <section className="section">
            <h2>응답자 분포{track !== "all" && ` — Track ${track}`}</h2>
            <div className="rule" />
            <div className="q">
              <div className="q-head">
                <div className="q-label">
                  <span>본부별</span>
                </div>
                <div className="q-hint">소속(팀) 응답을 본부 단위로 묶은 분포. 매칭되지 않은 팀은 "미분류"로 표시됩니다.</div>
              </div>
              <Bars data={divisionDist(trackRows)} total={tTotal} alt />
            </div>
            {PROFILE_BREAKDOWN.map((p) => (
              <div className="q" key={p.id}>
                <div className="q-head">
                  <div className="q-label">
                    <span>{p.label}별</span>
                  </div>
                </div>
                <Bars data={profileDist(trackRows, p.id)} total={tTotal} alt />
              </div>
            ))}
          </section>

          {/* 문항별 집계 */}
          {SECTIONS.filter((s) => s.id !== "profile").map((sec) => (
            <section className="section" key={sec.id}>
              <h2>{sec.title}{track !== "all" && ` — Track ${track}`}</h2>
              <div className="rule" />
              {sec.questions.map((q) => (
                <ResultBlock key={q.id} q={q} rows={trackRows} total={tTotal} />
              ))}
            </section>
          ))}
        </>
      )}

      {selected && (
        <DetailModal
          r={selected}
          track={trackMap.get(selected.id) || "-"}
          onClose={() => setSelected(null)}
        />
      )}

      {scoreDetail && (
        <ScoreInfoModal r={scoreDetail} onClose={() => setScoreDetail(null)} />
      )}
    </main>
  );
}

// 점수 구성 + ⚠ 사유 모달
function ScoreInfoModal({ r, onClose }: { r: Row; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const sc = levelScore(r);
  const selfPct = Math.round(sc.self * 100);
  const othersPct = Math.round(sc.others * 100);
  const expList = advExpList(r.answers || {});

  const rows: { label: string; idx: number; max: number; weight: string }[] = [
    { label: "난이도 자가진단 (Q14)", idx: optIndex("q14", r.answers?.q14), max: 8, weight: "40%" },
    { label: "AI 업무 활용 (Q5)", idx: optIndex("q5", r.answers?.q5), max: 6, weight: "20%" },
    { label: "AI 사용 빈도 (Q1)", idx: optIndex("q1", r.answers?.q1), max: 5, weight: "10%" },
    { label: "Agent 인식 (Q8)", idx: optIndex("q7", r.answers?.q7), max: 5, weight: "5%" },
    { label: "자동화 인식 (Q9)", idx: optIndex("q8", r.answers?.q8), max: 5, weight: "5%" },
  ];

  return (
    <div className="modal-bg" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal sm" onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <div className="m-id">
            <div className="m-name">{r.respondent?.name || "-"} · 종합 {sc.score}점</div>
            <div className="m-sub">{r.respondent?.org || "-"} · {r.respondent?.rank || "-"}</div>
          </div>
          <button className="m-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="m-body">
          {sc.gap ? (
            <div className="gap-note">
              <b>⚠ 분반 시 확인 권장</b>
              <p>
                {sc.self > sc.others
                  ? `자가진단이 실제 경험 신호보다 크게 높습니다 (자가진단 환산 ${selfPct}점 vs 경험·활용 신호 ${othersPct}점). 스스로 평가한 수준(Q14)에 비해 고급 기능 사용 경험이 적어, 상위 Track 배정 시 확인이 필요합니다.`
                  : `자가진단이 실제 경험 신호보다 크게 낮습니다 (자가진단 환산 ${selfPct}점 vs 경험·활용 신호 ${othersPct}점). 경험·활용 신호는 높은데 낮은 단계를 선택한 겸손 응답일 가능성이 있어, 상향 배정 검토를 권장합니다.`}
              </p>
            </div>
          ) : (
            <div className="gap-note ok">
              자가진단(환산 {selfPct}점)과 경험·활용 신호({othersPct}점)가 대체로 일치합니다.
            </div>
          )}

          <div className="m-sec">
            <div className="m-sec-t">점수 구성</div>
            <table className="score-table">
              <tbody>
                {rows.map((x) => (
                  <tr key={x.label}>
                    <td>{x.label}</td>
                    <td className="v">{x.idx ? `${x.idx} / ${x.max}단계` : "-"}</td>
                    <td className="w">{x.weight}</td>
                  </tr>
                ))}
                <tr>
                  <td>고급 기능 실경험 (Q3·Q6)</td>
                  <td className="v">{expList.length}개 {expList.length >= 6 && "(만점)"}</td>
                  <td className="w">20%</td>
                </tr>
              </tbody>
            </table>
            {expList.length > 0 && (
              <div className="tags" style={{ marginTop: 8 }}>
                {expList.map((t) => (
                  <span className="tag" key={t}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 응답자 개별 응답 내역 모달
function DetailModal({
  r,
  track,
  onClose,
}: {
  r: Row;
  track: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const sc = levelScore(r);

  return (
    <div className="modal-bg" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <div className="m-id">
            <div className="m-name">{r.respondent?.name || "(이름 없음)"}</div>
            <div className="m-sub">
              {r.respondent?.org || "-"} · {r.respondent?.rank || "-"} · 제출 {fmtDate(r.created_at)}
            </div>
          </div>
          <div className="m-badges">
            <span className="score-badge">{sc.score}{sc.gap && <em className="gap">⚠</em>}</span>
            <span className={`tk-chip big tk-${track}`}>Track {track}</span>
          </div>
          <button className="m-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="m-body">
          {SECTIONS.filter((s) => s.id !== "profile").map((sec) => (
            <div className="m-sec" key={sec.id}>
              <div className="m-sec-t">{sec.title}</div>
              {sec.questions.map((q) => {
                const v = r.answers?.[q.id];
                const other = r.answers?.[`${q.id}__other`];
                return (
                  <div className="m-q" key={q.id}>
                    <div className="m-q-l">
                      {q.no && <span className="q-no">{q.no}</span>}
                      <span>{q.label}</span>
                    </div>
                    <div className="m-q-a">
                      {Array.isArray(v) ? (
                        v.length ? (
                          <div className="tags">
                            {v.map((t: string) => (
                              <span className="tag" key={t}>{t}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted">무응답</span>
                        )
                      ) : typeof v === "string" && v.trim() !== "" ? (
                        v
                      ) : (
                        <span className="muted">무응답</span>
                      )}
                      {typeof other === "string" && other.trim() !== "" && (
                        <div className="m-other">기타 입력: {other}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ r, onClick }: { r: Row; onClick?: () => void }) {
  const { score, gap } = levelScore(r);
  return (
    <span
      className={`score-badge${onClick ? " clickable" : ""}`}
      onClick={onClick}
      title={
        "종합 점수 " + score + "점 — 클릭하면 점수 구성을 볼 수 있습니다" +
        (gap ? "\n⚠ 자가진단과 실제 경험 신호의 차이가 큼 — 클릭해서 사유 확인" : "")
      }
    >
      {score}
      {gap && <em className="gap">⚠</em>}
    </span>
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

// 본부별 분포: DIVISIONS 순서 고정, 미분류는 맨 뒤
function divisionDist(rows: Row[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const d = orgDivision(r.respondent?.org || "");
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  const out: { label: string; count: number }[] = [];
  for (const d of DIVISIONS) {
    out.push({ label: d, count: counts.get(d) || 0 });
  }
  const etc = counts.get("미분류") || 0;
  if (etc > 0) out.push({ label: "미분류 (매핑 확인 필요)", count: etc });
  return out;
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
