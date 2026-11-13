// HL7 v2 parser: pure functions, no I/O. f[n] is field n of a segment (f[0] is the name).
export type Delims = { field: string; comp: string; rep: string; esc: string; sub: string };
export type Segment = { name: string; f: string[] };
export type Hl7Message = { segments: Segment[]; delims: Delims };

export class Hl7ParseError extends Error {}

/** Splits on \r, \n or \r\n and reads the delimiters from MSH. Throws Hl7ParseError if there is no MSH. */
export function parseMessage(text: string): Hl7Message {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim() !== "");
  if (!lines[0]?.startsWith("MSH") || lines[0].length < 8)
    throw new Hl7ParseError("Message must start with an MSH segment");
  const field = lines[0][3];
  const [comp = "^", rep = "~", esc = "\\", sub = "&"] = lines[0].slice(4, 8).split("");
  const delims = { field, comp, rep, esc, sub };
  const segments = lines.map((line) => {
    const parts = line.split(field);
    // MSH-1 is the field separator itself, so MSH fields are shifted by one.
    if (parts[0] === "MSH") parts.splice(1, 0, field);
    return { name: parts[0], f: parts };
  });
  return { segments, delims };
}

/** Decodes HL7 escape sequences: \F\ \S\ \T\ \R\ \E\ \.br\ \Xhh..\ */
export function unescape(value: string, d: Delims): string {
  if (!value.includes(d.esc)) return value;
  const e = d.esc.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  return value.replace(new RegExp(`${e}([^${e}]*)${e}`, "g"), (whole, code: string) => {
    switch (code) {
      case "F":
        return d.field;
      case "S":
        return d.comp;
      case "T":
        return d.sub;
      case "R":
        return d.rep;
      case "E":
        return d.esc;
      case ".br":
        return "\n";
      default:
        return /^X([0-9A-Fa-f]{2})+$/.test(code)
          ? Buffer.from(code.slice(1), "hex").toString("latin1")
          : whole;
    }
  });
}

/** First repetition of field n, split into components, each unescaped. Missing = []. */
export function comps(seg: Segment | undefined, n: number, d: Delims): string[] {
  const raw = seg?.f[n] ?? "";
  return raw
    .split(d.rep)[0]
    .split(d.comp)
    .map((c) => unescape(c, d));
}

/** Component k (1-based) of field n, or "". */
export const val = (seg: Segment | undefined, n: number, d: Delims, k = 1) => comps(seg, n, d)[k - 1] ?? "";

/** Every repetition of field n, each as components. */
export function reps(seg: Segment | undefined, n: number, d: Delims): string[][] {
  const raw = seg?.f[n] ?? "";
  return raw === "" ? [] : raw.split(d.rep).map((r) => r.split(d.comp).map((c) => unescape(c, d)));
}
