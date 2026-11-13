import type { CodeableConcept, HumanName, Quantity } from "fhir/r4";

const SYDNEY = "Australia/Sydney";

/** Given names then family name, preferring the "official" name. */
export function humanName(names: HumanName[] | undefined): string {
  const name = names?.find((n) => n.use === "official") ?? names?.[0];
  if (!name) return "Unknown name";
  if (name.text) return name.text;
  return [...(name.given ?? []), name.family].filter(Boolean).join(" ") || "Unknown name";
}

/** Text of a CodeableConcept: its text, else the first coding's display, else its code. */
export function codeableText(concept: CodeableConcept | undefined, fallback = "Unknown"): string {
  const coding = concept?.coding?.[0];
  return concept?.text || coding?.display || coding?.code || fallback;
}

/** "6.3 %" — value rounded to at most 2 decimals, with its unit. */
export function quantityText(q: Quantity | undefined): string {
  if (q?.value === undefined) return "—";
  const value = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(q.value);
  const unit = q.unit ?? q.code;
  return unit ? `${q.comparator ?? ""}${value} ${unit}` : `${q.comparator ?? ""}${value}`;
}

/**
 * FHIR date or dateTime as DD/MM/YYYY, keeping partial precision (YYYY, MM/YYYY).
 * A dateTime is shown as the calendar day in Sydney.
 */
export function formatDate(value: string | undefined): string {
  if (!value) return "—";
  if (/^\d{4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value.slice(5)}/${value.slice(0, 4)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Calendar day (YYYY-MM-DD) in Sydney for a Date. */
function sydneyDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SYDNEY }).format(date);
}

/** Whole years from birthDate to `at` (a FHIR date/dateTime or a Date; default now). */
export function ageInYears(
  birthDate: string | undefined,
  at: string | Date = new Date(),
): number | undefined {
  if (!birthDate || !/^\d{4}/.test(birthDate)) return undefined;
  const atDay =
    typeof at === "string" ? (/^\d{4}-\d{2}-\d{2}$/.test(at) ? at : sydneyDay(new Date(at))) : sydneyDay(at);
  // Missing month/day in a partial birth date count as January / the 1st.
  const [by, bm = 1, bd = 1] = birthDate.slice(0, 10).split("-").map(Number);
  const [ay, am, ad] = atDay.split("-").map(Number);
  if ([ay, am, ad].some(Number.isNaN)) return undefined;
  const hadBirthday = am > bm || (am === bm && ad >= bd);
  return ay - by - (hadBirthday ? 0 : 1);
}
