import { createHash } from "node:crypto";
import type { Bundle, DiagnosticReport, Observation, Quantity } from "fhir/r4";
import { IHI_SYSTEM } from "@/lib/fhir/clinical";
import { type Hl7Message, type Segment, comps, reps, val } from "./parse";

const UCUM = "http://unitsofmeasure.org";
const INTERP = "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";
const FILLER_SYSTEM = "http://cliniq.example/hl7v2/filler-order";
const CODE_SYSTEMS: Record<string, string> = {
  LN: "http://loinc.org",
  SCT: "http://snomed.info/sct",
  SNM: "http://snomed.info/sct",
};

export class Hl7MapError extends Error {}

/** HL7 timestamp to FHIR date/dateTime, keeping precision. With no offset anywhere, a time is dropped (date only). */
export function hl7Time(value: string, defaultOffset?: string): string | undefined {
  const m = /^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:\.\d+)?([+-]\d{4})?$/.exec(value.trim());
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s, off] = m;
  if (!mo) return y;
  if (!d) return `${y}-${mo}`;
  const date = `${y}-${mo}-${d}`;
  const offset = off ?? defaultOffset;
  if (!h || !mi || !offset) return date;
  return `${date}T${h}:${mi}:${s ?? "00"}${offset.slice(0, 3)}:${offset.slice(3)}`;
}

const offsetOf = (ts: string) => /([+-]\d{4})$/.exec(ts.trim())?.[1];
const num = (s: string) => (/^[+-]?\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : undefined);

function quantity(value: number, unit: string[], comparator?: Quantity["comparator"]): Quantity {
  const [id, text, system] = unit; // OBX-6 is CE: code^text^coding system
  return {
    value,
    ...(comparator && { comparator }),
    ...((text || id) && { unit: text || id }),
    ...(system === "UCUM" && { system: UCUM, code: id }),
  };
}

/** Reference range text: "45-90", "<5.0", ">3", else free text. */
export function referenceRange(raw: string, unit: string[]): Observation["referenceRange"] {
  const t = raw.trim();
  if (!t) return undefined;
  const between = /^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/.exec(t);
  if (between) return [{ low: quantity(Number(between[1]), unit), high: quantity(Number(between[2]), unit) }];
  const one = /^([<>]=?)\s*(-?\d+(?:\.\d+)?)$/.exec(t);
  if (one)
    return [
      one[1][0] === "<" ? { high: quantity(Number(one[2]), unit) } : { low: quantity(Number(one[2]), unit) },
    ];
  return [{ text: t }];
}

const OBX_STATUS: Record<string, Observation["status"]> = {
  F: "final",
  C: "corrected",
  P: "preliminary",
  X: "cancelled",
  D: "entered-in-error",
  W: "entered-in-error",
};
const OBR_STATUS: Record<string, DiagnosticReport["status"]> = {
  F: "final",
  C: "corrected",
  P: "preliminary",
  X: "cancelled",
};

const hashId = (...parts: string[]) =>
  "hl7-" + createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);

const uuidOf = (s: string) =>
  createHash("sha256")
    .update(s)
    .digest("hex")
    .replace(/^(.{8})(.{4}).(.{3}).(.{3})(.{12}).*$/, "$1-$2-4$3-8$4-$5");

/** The patient's IHI from PID-3 (identifier type NI), if present. */
export function ihiOf(msg: Hl7Message): string | undefined {
  const pid = msg.segments.find((s) => s.name === "PID");
  return reps(pid, 3, msg.delims).find((r) => r[4] === "NI" && r[0])?.[0];
}
export const patientQuery = (ihi: string) => `Patient?identifier=${IHI_SYSTEM}|${ihi}`;

function observation(
  obx: Segment,
  msg: Hl7Message,
  ctx: { patientId: string; filler: string; effective?: string; offset?: string },
  notes: string[],
): Observation {
  const d = msg.delims;
  const code = comps(obx, 3, d);
  const type = val(obx, 2, d);
  const unit = comps(obx, 6, d);
  const o: Observation = {
    resourceType: "Observation",
    id: hashId(ctx.filler, code[0] ?? "", val(obx, 4, d)),
    status: OBX_STATUS[val(obx, 11, d)] ?? "unknown",
    category: [
      {
        coding: [
          { system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" },
        ],
      },
    ],
    code: {
      coding: [
        { system: CODE_SYSTEMS[code[2] ?? ""] ?? undefined, code: code[0], display: code[1] || undefined },
      ],
    },
    subject: { reference: `Patient/${ctx.patientId}` },
  };
  const when = hl7Time(val(obx, 14, d), ctx.offset) ?? ctx.effective;
  if (when) o.effectiveDateTime = when;

  const text = comps(obx, 5, d);
  const n = num(text[0] ?? "");
  if (type === "NM" && n !== undefined) {
    o.valueQuantity = quantity(n, unit);
  } else if (type === "SN" && /^[<>]=?$/.test(text[0] ?? "") && num(text[1] ?? "") !== undefined) {
    o.valueQuantity = quantity(Number(text[1]), unit, text[0] as Quantity["comparator"]);
  } else if (type === "CE" || type === "CWE") {
    o.valueCodeableConcept = {
      coding: [
        { system: CODE_SYSTEMS[text[2] ?? ""] ?? undefined, code: text[0], display: text[1] || undefined },
      ],
      text: text[1] || undefined,
    };
  } else {
    o.valueString = text.join(d.comp);
  }
  const range = referenceRange(val(obx, 7, d), unit);
  if (range) o.referenceRange = range;
  const interp = val(obx, 8, d);
  if (interp) o.interpretation = [{ coding: [{ system: INTERP, code: interp }] }];
  if (notes.length) o.note = notes.map((t) => ({ text: t }));
  return o;
}

/**
 * ORU^R01 to a FHIR transaction Bundle of PUTs with ids derived from the filler order number and
 * test code, so a resend or a correction updates the same resource.
 */
export function mapOru(msg: Hl7Message, patientId: string): Bundle {
  const d = msg.delims;
  const msh = msg.segments[0];
  const obr = msg.segments.find((s) => s.name === "OBR");
  if (!obr) throw new Hl7MapError("ORU^R01 has no OBR segment");
  const filler = val(obr, 3, d) || val(obr, 2, d);
  if (!filler) throw new Hl7MapError("OBR-3 (filler order number) is required");
  const offset = offsetOf(val(msh, 7, d));
  const effective = hl7Time(val(obr, 7, d), offset);

  // NTE lines attach to the OBX before them (or to the report when they follow the OBR).
  const observations: Observation[] = [];
  const reportNotes: string[] = [];
  let current: { obx: Segment; notes: string[] } | undefined;
  const flush = () =>
    current &&
    observations.push(observation(current.obx, msg, { patientId, filler, effective, offset }, current.notes));
  for (const s of msg.segments) {
    if (s.name === "OBX") {
      flush();
      current = { obx: s, notes: [] };
    } else if (s.name === "NTE") (current ? current.notes : reportNotes).push(val(s, 3, d));
    else if (s.name === "OBR" && s !== obr) break; // shortcut: one order per message
  }
  flush();
  if (!observations.length) throw new Hl7MapError("ORU^R01 has no OBX segments");

  const code = comps(obr, 4, d);
  const issued = hl7Time(val(obr, 22, d), offset);
  const report: DiagnosticReport = {
    resourceType: "DiagnosticReport",
    id: hashId(filler),
    identifier: [{ system: `${FILLER_SYSTEM}/${comps(obr, 3, d)[1] ?? ""}`, value: filler }],
    status: OBR_STATUS[val(obr, 25, d)] ?? "unknown",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0074", code: "LAB" }] }],
    code: {
      coding: [
        { system: CODE_SYSTEMS[code[2] ?? ""] ?? undefined, code: code[0], display: code[1] || undefined },
      ],
    },
    subject: { reference: `Patient/${patientId}` },
    ...(effective && { effectiveDateTime: effective }),
    ...(issued && { issued }),
    result: observations.map((o) => ({ reference: `Observation/${o.id}` })),
    ...(reportNotes.length && { conclusion: reportNotes.join(" ") }),
  };
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: [report, ...observations].map((resource) => ({
      fullUrl: `urn:uuid:${uuidOf(`${resource.resourceType}/${resource.id}`)}`,
      resource,
      request: { method: "PUT", url: `${resource.resourceType}/${resource.id}` },
    })),
  };
}
