// Deterministic first line: requests the assistant must not answer get a refusal and no model call.
export const REFUSAL =
  "I can only report what is in this record. I can't give diagnostic or treatment advice.";

const PATTERNS: [RegExp, string][] = [
  [/\bshould\s+(i|we|she|he|they|the patient)\b/i, "advice"],
  // Forward-looking only: "what was prescribed" and "what dose is she on" are record questions and must be answered.
  [/\b(prescribe|prescribing|titrate|up-?titrate|wean|taper)\b/i, "prescribing"],
  [
    /\b(stop|start|increase|reduce|change|switch|cease|continue)\s+(the\s+|her\s+|his\s+|their\s+)?\w*\s*(medic|drug|tablet|dose|inhibitor|blocker|statin|metformin|insulin)/i,
    "treatment",
  ],
  [/\b(diagnose|differential)\b/i, "diagnosis"],
  [
    /\b(does|did|could|might|may)\s+(this patient|the patient|he|she|they)\s+(have|has)\b[^?]*\b(cancer|carcinoma|tumou?r|malignan|lymphoma|leuk(a)?emia|dementia|hiv|stroke)\b/i,
    "diagnosis",
  ],
  [/\b(prognosis|life expectancy|survive|how long (will|does))\b/i, "prognosis"],
  [/\b(other|another|different|all|every)\s+(patients?|people)\b/i, "other patients"],
];

/** The refusal reason, or null if the question may continue. */
export function prefilter(question: string): string | null {
  return PATTERNS.find(([re]) => re.test(question))?.[1] ?? null;
}
