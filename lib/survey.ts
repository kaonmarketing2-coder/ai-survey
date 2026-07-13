// AI 활용 수준 사전 진단 Survey — 폼 렌더링과 결과 집계의 단일 소스(Single Source of Truth)

export type QuestionType = "single" | "multi" | "text" | "textarea";

export interface Question {
  id: string;
  no?: string; // 화면에 표시할 번호 (예: "Q1")
  label: string;
  hint?: string;
  type: QuestionType;
  options?: string[];
  required?: boolean;
  hasOther?: boolean; // multi 에서 "기타" 자유 입력 지원
  placeholder?: string;
}

export interface Section {
  id: string;
  title: string;
  questions: Question[];
}

export const SURVEY_TITLE = "AI 활용 수준 사전 진단 Survey";
export const SURVEY_DESC =
  "효과적인 AI 교육 설계를 위한 사전 진단입니다. 해당 내용은 단순 교육 커리큘럼 구성을 위한 참고자료로 활용될 예정이오니, 현재 본인 상황에 맞추어 솔직하게 응답해 주세요.";

export const SECTIONS: Section[] = [
  {
    id: "profile",
    title: "1. 기본 정보",
    questions: [
      { id: "org", label: "소속", type: "text", required: true, placeholder: "예: 마케팅팀" },
      { id: "rank", label: "직급", type: "text", required: true, placeholder: "예: 매니저" },
      {
        id: "name",
        label: "이름",
        hint: "수업 분반 배정을 위해 필요하니 실명을 입력해 주세요.",
        type: "text",
        required: true,
        placeholder: "홍길동",
      },
    ],
  },
  {
    id: "current-level",
    title: "2. 현재 AI 활용 수준",
    questions: [
      {
        id: "q1",
        no: "Q1",
        label: "업무에서 생성형 AI를 얼마나 사용하고 있습니까?",
        hint: "단일선택",
        type: "single",
        required: true,
        options: [
          "① 거의 사용하지 않는다.",
          "② 가끔 검색이나 번역 정도만 사용한다.",
          "③ 업무에 주 1~2회 정도 활용한다.",
          "④ 거의 매일 사용한다.",
          "⑤ AI 없이는 업무하기 어려울 정도로 활용한다.",
        ],
      },
      {
        id: "q2",
        no: "Q2",
        label: "현재 사용 중인 AI Tool을 모두 선택해 주세요.",
        hint: "복수선택",
        type: "multi",
        required: true,
        hasOther: true,
        options: [
          "Claude",
          "ChatGPT",
          "Gemini",
          "Microsoft Copilot",
          "Perplexity",
          "NotebookLM",
          "Gamma",
          "Canva AI",
          "Midjourney",
          "기타",
          "사용하지 않음",
        ],
      },
    ],
  },
  {
    id: "claude-level",
    title: "3. Claude 활용 수준",
    questions: [
      {
        id: "q3",
        no: "Q3",
        label: "Claude에서 실제 사용해본 기능을 모두 선택해 주세요.",
        hint: "복수선택",
        type: "multi",
        required: true,
        options: [
          "일반 질문하기",
          "문서 요약",
          "이메일 작성",
          "번역",
          "PPT 작성",
          "엑셀 분석",
          "긴 문서 업로드 후 분석",
          "이미지 분석",
          "Artifact 생성",
          "Projects 사용",
          "MCP(Server) 연결",
          "Claude Code",
          "Agent 생성",
          "API 활용",
          "사용해본 적 없음",
        ],
      },
      {
        id: "q4",
        no: "Q4",
        label: "Claude를 사용할 때 가장 많이 하는 작업은 무엇입니까?",
        hint: "주관식",
        type: "textarea",
        required: true,
        placeholder: "예: 회의록 요약, 보고서 초안 작성 등 (없다면 '없음')",
      },
    ],
  },
  {
    id: "work-level",
    title: "4. AI 업무 활용 수준",
    questions: [
      {
        id: "q5",
        no: "Q5",
        label: "현재 AI를 업무에 활용하는 수준은 어느 정도라고 생각하십니까?",
        hint: "단일선택",
        type: "single",
        required: true,
        options: [
          "① 전혀 활용하지 않는다.",
          "② AI에게 글을 작성시키는 정도이다.",
          "③ 자료를 분석하거나 요약하는 수준이다.",
          "④ 반복 업무 일부를 AI와 함께 처리한다.",
          "⑤ AI를 활용해 업무 프로세스를 개선하고 있다.",
          "⑥ AI를 활용한 자동화까지 구현하고 있다.",
        ],
      },
      {
        id: "q6",
        no: "Q6",
        label: "아래 항목 중 경험이 있는 것을 모두 선택해 주세요.",
        hint: "복수선택",
        type: "multi",
        required: true,
        options: [
          "프롬프트를 직접 설계해본 경험",
          "여러 AI를 함께 사용",
          "반복되는 업무를 AI로 자동화",
          "Python을 이용한 AI 활용",
          "Claude Code 활용",
          "MCP 활용",
          "Agent 제작",
          "API 연동",
          "해당 없음",
        ],
      },
      {
        id: "q16",
        no: "Q7",
        label: "업무에 AI를 활용하기 어렵다고 느끼는 이유는 무엇입니까?",
        hint: "복수선택",
        type: "multi",
        required: true,
        hasOther: true,
        options: [
          "보안 규정상 외부 AI에 올릴 수 없는 자료가 많아서",
          "어떤 업무에 활용할 수 있을지 몰라서",
          "반복되는 업무가 없어서",
          "결과물을 신뢰하기 어려워서",
          "프롬프트 작성 등 사용법이 어려워서",
          "배울 시간이나 기회가 없어서",
          "기존 방식이 더 빠르고 익숙해서",
          "특별히 어려움 없음",
          "기타",
        ],
      },
    ],
  },
  {
    id: "automation",
    title: "5. 업무 자동화 이해 수준",
    questions: [
      {
        id: "q7",
        no: "Q8",
        label: '본인이 생각하는 "AI Agent"의 역할/개념에 가장 가까운 것은 무엇입니까?',
        type: "single",
        required: true,
        options: [
          "① 처음 들어봐서 잘 모르겠다.",
          "② 질문에 답해주는 챗봇이라고 생각한다.",
          "③ 지시하면 문서 작성·요약 등 결과물을 만들어주는 AI 도구라고 생각한다.",
          "④ 목표를 주면 스스로 계획을 세우고 단계별로 작업을 수행하는 AI라고 생각한다.",
          "⑤ 외부 시스템(메일·엑셀·DB 등)과 연동되어 업무 전체를 자동으로 처리하는 AI라고 생각한다.",
        ],
      },
      {
        id: "q8",
        no: "Q9",
        label: "업무 자동화에 대해 가장 가까운 생각은 무엇입니까?",
        type: "single",
        required: true,
        options: [
          "① 무엇을 자동화할 수 있는지 모르겠다.",
          "② 자동화하면 좋겠지만 방법을 모르겠다.",
          "③ 자동화 아이디어는 있다.",
          "④ 일부 자동화를 직접 구현해봤다.",
          "⑤ 여러 업무를 자동화하여 사용 중이다.",
        ],
      },
    ],
  },
  {
    id: "work-analysis",
    title: "6. 업무 분석",
    questions: [
      {
        id: "q9",
        no: "Q10",
        label: "본인의 업무 중 가장 많은 시간이 소요되는 작업은 무엇입니까?",
        hint: "복수선택",
        type: "multi",
        required: true,
        hasOther: true,
        options: [
          "자료 조사",
          "문서 작성",
          "PPT 작성",
          "보고서 작성",
          "메일 작성",
          "회의록 정리",
          "데이터 취합",
          "엑셀 작업",
          "반복 입력 업무",
          "이미지 제작",
          "번역",
          "기타",
        ],
      },
      {
        id: "q10",
        no: "Q11",
        label: "위 업무 중 AI가 가장 먼저 해결해주었으면 하는 업무는 무엇입니까?",
        hint: "주관식",
        type: "textarea",
        required: true,
        placeholder: "예: 매주 반복되는 실적 보고서 작성",
      },
      {
        id: "q11",
        no: "Q12",
        label: "현재 반복적으로 수행하는 업무가 있다면 자유롭게 작성해주세요.",
        hint: "주관식",
        type: "textarea",
        required: true,
        placeholder: "예: 매일 아침 데이터 취합 후 메일 발송",
      },
    ],
  },
  {
    id: "expectation",
    title: "7. 교육 기대사항",
    questions: [
      {
        id: "q12",
        no: "Q13",
        label: "이번 교육에서 가장 기대하는 것은 무엇입니까?",
        hint: "복수선택",
        type: "multi",
        required: true,
        hasOther: true,
        options: [
          "AI 기초 개념 이해",
          "AI 툴 사용법 익히기 (설치 ~ 프롬프트 작성)",
          "AI 활용팁 습득 (Skills, MCP 등)",
          "AI 기반 실무 산출물 직접 제작 (문서/PPT/데이터 분석 등)",
          "업무 자동화 구현",
          "AI Agent 만들기",
          "기타",
        ],
      },
    ],
  },
  {
    id: "difficulty",
    title: "8. 교육 난이도 진단",
    questions: [
      {
        id: "q14",
        no: "Q14",
        label: "아래 중 본인에게 가장 가까운 수준을 선택해주세요.",
        type: "single",
        required: true,
        options: [
          "① AI를 거의 사용하지 않는다.",
          "② ChatGPT/Claude에게 질문하고 답변을 받는 정도이다.",
          "③ 문서 작성·요약·번역을 AI로 처리할 수 있다.",
          "④ 엑셀 분석, PPT 초안 등 실무 산출물을 AI로 만들 수 있다.",
          "⑤ 다양한 AI Tool을 조합하여 사용한다.",
          "⑥ AI를 이용하여 대시보드/웹페이지를 만들 수 있다.",
          "⑦ 반복 업무를 AI로 자동화한 경험이 있다.",
          "⑧ Agent를 직접 만들어 업무에 활용 중이다.",
        ],
      },
    ],
  },
  {
    id: "etc",
    title: "9. 기타 의견",
    questions: [
      {
        id: "q15",
        no: "Q15",
        label: "AI 교육에 대해 바라는 점이나 요청사항이 있다면 자유롭게 작성해주세요.",
        hint: "주관식",
        type: "textarea",
        required: true,
        placeholder: "자유롭게 작성해 주세요.",
      },
    ],
  },
];

// 편의: 전체 질문 평탄화
export const ALL_QUESTIONS: Question[] = SECTIONS.flatMap((s) => s.questions);

// 프로필(기본 정보) 필드 id
export const PROFILE_IDS = ["org", "rank", "name"];

// 결과 페이지에서 분포 카드로 보여줄 프로필 필드
export const PROFILE_BREAKDOWN = [
  { id: "org", label: "소속" },
  { id: "rank", label: "직급" },
];
