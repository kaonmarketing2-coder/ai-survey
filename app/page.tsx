"use client";

import { useMemo, useRef, useState } from "react";
import {
  SECTIONS,
  ALL_QUESTIONS,
  SURVEY_TITLE,
  SURVEY_DESC,
  type Question,
} from "@/lib/survey";
import { supabase, TABLE } from "@/lib/supabase";

type Values = Record<string, string | string[]>;

export default function SurveyPage() {
  const [values, setValues] = useState<Values>({});
  const [others, setOthers] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const answeredCount = useMemo(() => {
    return ALL_QUESTIONS.filter((q) => {
      const v = values[q.id];
      if (Array.isArray(v)) return v.length > 0;
      return typeof v === "string" && v.trim() !== "";
    }).length;
  }, [values]);
  const progress = Math.round((answeredCount / ALL_QUESTIONS.length) * 100);

  function setText(id: string, v: string) {
    setValues((s) => ({ ...s, [id]: v }));
    clearInvalid(id);
  }
  function setSingle(id: string, opt: string) {
    setValues((s) => ({ ...s, [id]: opt }));
    clearInvalid(id);
  }
  function toggleMulti(id: string, opt: string) {
    setValues((s) => {
      const cur = Array.isArray(s[id]) ? [...(s[id] as string[])] : [];
      const i = cur.indexOf(opt);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(opt);
      return { ...s, [id]: cur };
    });
    clearInvalid(id);
  }
  function clearInvalid(id: string) {
    setInvalid((s) => {
      if (!s.has(id)) return s;
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }

  function validate(): Set<string> {
    const bad = new Set<string>();
    for (const q of ALL_QUESTIONS) {
      if (!q.required) continue;
      const v = values[q.id];
      const ok = Array.isArray(v)
        ? v.length > 0
        : typeof v === "string" && v.trim() !== "";
      if (!ok) bad.add(q.id);
    }
    return bad;
  }

  async function onSubmit() {
    setError(null);
    const bad = validate();
    setInvalid(bad);
    if (bad.size > 0) {
      const first = ALL_QUESTIONS.find((q) => bad.has(q.id));
      if (first) {
        document
          .getElementById(`q-${first.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setError("필수 항목을 모두 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const respondent = {
        org: (values.org as string) || "",
        rank: (values.rank as string) || "",
        name: (values.name as string) || "",
      };
      const answers: Record<string, unknown> = {};
      for (const q of ALL_QUESTIONS) {
        if (["org", "rank", "name"].includes(q.id)) continue;
        const v = values[q.id];
        if (v === undefined) continue;
        if (Array.isArray(v)) {
          if (v.length) answers[q.id] = v;
        } else if (typeof v === "string" && v.trim() !== "") {
          answers[q.id] = v.trim();
        }
        if (q.hasOther) {
          const arr = Array.isArray(v) ? v : [];
          const otherText = (others[q.id] || "").trim();
          if (arr.includes("기타") && otherText) {
            answers[`${q.id}__other`] = otherText;
          }
        }
      }

      const { error: insErr } = await supabase
        .from(TABLE)
        .insert({ respondent, answers });
      if (insErr) throw insErr;
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setError("제출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. (" + (e?.message || "unknown") + ")");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="page">
        <Header />
        <div className="done">
          <div className="check">✓</div>
          <h2>응답이 제출되었습니다. 감사합니다!</h2>
          <p>소중한 응답이 이번 교육 설계에 큰 도움이 됩니다.</p>
          <div className="row">
            <button
              className="btn secondary"
              onClick={() => {
                setValues({});
                setOthers({});
                setDone(false);
              }}
            >
              새 응답 작성
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page" ref={formRef}>
      <Header />

      <div className="hero">
        <h1>{SURVEY_TITLE}</h1>
        <p>{SURVEY_DESC}</p>
      </div>

      <div className="progress-wrap">
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="progress-meta">
          <span>
            {answeredCount} / {ALL_QUESTIONS.length} 응답
          </span>
          <span>{progress}%</span>
        </div>
      </div>

      {error && <div className="err-banner">{error}</div>}

      {SECTIONS.map((sec) => (
        <section className="section" key={sec.id}>
          <h2>{sec.title}</h2>
          <div className="rule" />
          {sec.questions.map((q) => (
            <QuestionField
              key={q.id}
              q={q}
              value={values[q.id]}
              other={others[q.id] || ""}
              invalid={invalid.has(q.id)}
              onText={setText}
              onSingle={setSingle}
              onToggle={toggleMulti}
              onOther={(id, v) => setOthers((s) => ({ ...s, [id]: v }))}
            />
          ))}
        </section>
      ))}

      <div className="actions">
        <button className="btn" onClick={onSubmit} disabled={submitting}>
          {submitting ? "제출 중…" : "제출하기"}
        </button>
      </div>
    </main>
  );
}

function Header() {
  return (
    <div className="topbar">
      <div className="brand">
        <span className="dot">AI</span>
        <span>사전 진단 Survey</span>
      </div>
    </div>
  );
}

function QuestionField({
  q,
  value,
  other,
  invalid,
  onText,
  onSingle,
  onToggle,
  onOther,
}: {
  q: Question;
  value: string | string[] | undefined;
  other: string;
  invalid: boolean;
  onText: (id: string, v: string) => void;
  onSingle: (id: string, opt: string) => void;
  onToggle: (id: string, opt: string) => void;
  onOther: (id: string, v: string) => void;
}) {
  const arr = Array.isArray(value) ? value : [];
  const showOther = q.hasOther && arr.includes("기타");

  return (
    <div className={`q${invalid ? " invalid" : ""}`} id={`q-${q.id}`}>
      <div className="q-head">
        <div className="q-label">
          {q.no && <span className="q-no">{q.no}</span>}
          <span>
            {q.label}
            {q.required && <span className="req">*</span>}
          </span>
        </div>
        {q.hint && <div className="q-hint">{q.hint}</div>}
      </div>

      {q.type === "text" && (
        <input
          type="text"
          placeholder={q.placeholder}
          value={(value as string) || ""}
          onChange={(e) => onText(q.id, e.target.value)}
        />
      )}

      {q.type === "textarea" && (
        <textarea
          placeholder={q.placeholder}
          value={(value as string) || ""}
          onChange={(e) => onText(q.id, e.target.value)}
        />
      )}

      {q.type === "single" && (
        <div className="options">
          {q.options?.map((opt) => {
            const checked = value === opt;
            return (
              <label className={`opt${checked ? " checked" : ""}`} key={opt}>
                <input
                  type="radio"
                  name={q.id}
                  checked={checked}
                  onChange={() => onSingle(q.id, opt)}
                />
                <span className="lab">{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {q.type === "multi" && (
        <div className="options">
          {q.options?.map((opt) => {
            const checked = arr.includes(opt);
            return (
              <label className={`opt${checked ? " checked" : ""}`} key={opt}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(q.id, opt)}
                />
                <span className="lab">{opt}</span>
              </label>
            );
          })}
          {showOther && (
            <div className="other-row">
              <input
                type="text"
                placeholder="기타 내용을 입력해 주세요"
                value={other}
                onChange={(e) => onOther(q.id, e.target.value)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
