// 소속(팀) → 본부 매핑. 응답 원문의 표기 변형(공백/대소문자)을 정규화해 매칭합니다.
// 분류가 애매한 팀은 아래 주석에 가정을 표시 — 조직도와 다르면 이 파일만 수정하면 됩니다.

export const DIVISIONS = [
  "영업본부",
  "PM본부",
  "Corporate실",
  "경영지원본부",
  "PI그룹",
  "Risk Management본부",
] as const;

const EXACT: Record<string, string> = {
  // 영업본부 — 지역 사업그룹 포함
  "영업": "영업본부",
  "영업본부": "영업본부",
  "na팀": "영업본부",
  "북미사업그룹": "영업본부",
  "emea1": "영업본부",
  "emea1팀": "영업본부",
  "emea2팀": "영업본부",
  "apme팀": "영업본부",
  "국내1사업그룹": "영업본부",
  "국내2사업그룹": "영업본부",
  "공공사업파트": "영업본부",
  "bd팀": "영업본부",      // 가정: 사업개발 → 영업본부
  "마케팅팀": "영업본부",   // 가정: 영업본부 산하
  "cs팀": "영업본부",      // 가정: 고객지원 → 영업본부

  // PM본부
  "pm1팀": "PM본부",
  "pm2팀": "PM본부",
  "pmo": "PM본부",
  "개발관리팀": "PM본부",   // 가정: 개발 프로젝트 관리 → PM본부
  "디자인팀": "PM본부",     // 가정: 제품 UI/UX → PM본부

  // Corporate실
  "기획팀": "Corporate실",
  "법무": "Corporate실",
  "ip팀": "Corporate실",
  "ipr팀": "Corporate실",
  "esg팀": "Corporate실",     // 가정
  "투자운용팀": "Corporate실", // 가정

  // 경영지원본부
  "인사팀": "경영지원본부",
  "총무파트": "경영지원본부",
  "회계관리팀": "경영지원본부",
  "전산팀": "경영지원본부",   // 가정: 사내 IT → 경영지원 (PI그룹일 수도)
  "구매기획팀": "경영지원본부", // 가정: 구매/물류/자재 → 경영지원 (별도 SCM 조직이면 수정)
  "물류팀": "경영지원본부",
  "자재팀": "경영지원본부",

  // PI그룹
  "pi팀": "PI그룹",
  "자동화솔루션팀": "PI그룹",

  // Risk Management본부
  "품질관리팀": "Risk Management본부",
  "qa팀": "Risk Management본부",
};

function normalize(org: string): string {
  return org.toLowerCase().replace(/\s+/g, "").trim();
}

export function orgDivision(org: string): string {
  const n = normalize(org || "");
  if (!n) return "미분류";
  if (EXACT[n]) return EXACT[n];
  // 표기 변형 대응 키워드 규칙 (순서 중요)
  if (n.includes("sqa") || n.includes("hqa")) return "Risk Management본부";
  if (n.includes("품질")) return "Risk Management본부";
  if (n.includes("제조")) return "Risk Management본부"; // 가정: 제조기술/제조관리 → RM본부
  if (n.includes("자동화")) return "PI그룹";
  if (n.includes("emea") || n.includes("apme")) return "영업본부";
  if (n.includes("사업그룹") || n.includes("영업")) return "영업본부";
  if (n.includes("pm")) return "PM본부";
  if (n.includes("디자인")) return "PM본부";
  return "미분류";
}
