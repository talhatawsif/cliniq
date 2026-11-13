import { type Hl7Message, comps, val } from "./parse";

export type AckCode = "AA" | "AE" | "AR";

const esc = (s: string) =>
  s
    .replace(/\\/g, "\\E\\")
    .replace(/\|/g, "\\F\\")
    .replace(/\^/g, "\\S\\")
    .replace(/&/g, "\\T\\")
    .replace(/~/g, "\\R\\");
const stamp = (d: Date) => d.toISOString().replace(/\D/g, "").slice(0, 14);

/** ACK for a parsed message (sending and receiving swapped); `msg` null when the input was not HL7. */
export function buildAck(msg: Hl7Message | null, code: AckCode, text: string, now = new Date()): string {
  const m = msg?.segments[0];
  const d = msg?.delims;
  const trigger = d ? (comps(m, 9, d)[1] ?? "") : "";
  const control = d ? val(m, 10, d) : "";
  const swap = (n: number) => (d ? esc(val(m, n, d)) : "");
  return (
    [
      `MSH|^~\\&|${swap(5)}|${swap(6)}|${swap(3)}|${swap(4)}|${stamp(now)}||ACK${trigger ? `^${trigger}` : ""}|ACK${esc(control)}|P|2.4`,
      `MSA|${code}|${esc(control)}|${esc(text)}`,
    ].join("\r") + "\r"
  );
}
