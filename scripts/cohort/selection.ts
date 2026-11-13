// The curated cohort. Each entry names the criteria it was picked for; build.ts re-checks every
// claim against the source record and fails if one is not true.
export type Criterion =
  | "ckd"
  | "hypertension"
  | "diabetes"
  | "lipids"
  | "polypharmacy" // ≥ 8 active medications
  | "older-woman" // woman aged ≥ 70
  | "allergies" // ≥ 3 allergies
  | "under-25"
  | "child" // under 18
  | "deceased"
  | "variety";

export const SELECTION: { id: string; criteria: Criterion[] }[] = [
  { id: "edb8edfe", criteria: ["ckd", "hypertension"] },
  { id: "a61af391", criteria: ["ckd", "hypertension", "lipids"] },
  { id: "4cca3f0b", criteria: ["diabetes", "hypertension", "lipids"] },
  { id: "74249e03", criteria: ["diabetes", "hypertension", "lipids"] },
  { id: "b50160cf", criteria: ["diabetes", "hypertension", "lipids"] },
  { id: "fc48751c", criteria: ["diabetes", "lipids"] },
  { id: "91e835e5", criteria: ["diabetes", "lipids"] },
  { id: "7da46686", criteria: ["polypharmacy"] },
  { id: "39c3c21f", criteria: ["older-woman", "polypharmacy", "hypertension"] },
  { id: "022542fe", criteria: ["older-woman", "lipids"] },
  { id: "9621db72", criteria: ["allergies", "hypertension"] },
  { id: "c8501e5a", criteria: ["allergies"] },
  { id: "ba4a716c", criteria: ["allergies"] },
  { id: "29ed4d98", criteria: ["under-25", "child", "allergies"] },
  { id: "cb7b5012", criteria: ["under-25", "child"] },
  { id: "cac48590", criteria: ["under-25", "child"] },
  { id: "7fe5eed8", criteria: ["under-25", "allergies"] },
  { id: "8e032e58", criteria: ["deceased", "diabetes", "polypharmacy"] },
  { id: "41c722a4", criteria: ["variety", "allergies", "lipids"] },
  { id: "6fe996e7", criteria: ["variety", "hypertension", "lipids"] },
];
