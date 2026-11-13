import type { Bundle } from "fhir/r4";
import { type AckCode, buildAck } from "./ack";

const AR: AckCode = "AR";
import { Hl7MapError, ihiOf, mapOru, patientQuery } from "./map";
import { type Hl7Message, Hl7ParseError, parseMessage, val } from "./parse";

export type Deps = {
  findPatientIds: (query: string) => Promise<string[]>;
  /** Error messages from $validate; empty when the Bundle is valid. */
  validate: (bundle: Bundle) => Promise<string[]>;
  write: (bundle: Bundle) => Promise<void>;
  alreadyAccepted: (controlId: string) => Promise<boolean>;
  log: (row: {
    controlId: string;
    messageType: string;
    status: "accepted" | "duplicate" | "failed";
    outcome: string;
    raw: string;
  }) => Promise<void>;
};

export type Result = {
  ack: string;
  code: AckCode;
  status: "accepted" | "duplicate" | "failed" | "dry-run";
  outcome: string;
  segments: { name: string; fields: string[] }[];
  bundle?: Bundle;
  validation?: string[];
};

/** Parse, map, validate and (unless dry run) write one HL7 v2 message, and say what happened as an ACK. */
export async function processMessage(
  text: string,
  deps: Deps,
  opts: { dryRun?: boolean; now?: Date } = {},
): Promise<Result> {
  let msg: Hl7Message | null = null;
  const done = async (code: AckCode, outcome: string, extra: Partial<Result> = {}): Promise<Result> => {
    const status = extra.status ?? (code === "AA" ? "accepted" : "failed");
    if (!opts.dryRun && msg && status !== "dry-run") {
      await deps.log({
        controlId: val(msg.segments[0], 10, msg.delims),
        messageType: val(msg.segments[0], 9, msg.delims, 1) + "^" + val(msg.segments[0], 9, msg.delims, 2),
        status: status as "accepted" | "duplicate" | "failed",
        outcome,
        raw: text,
      });
    }
    return {
      ack: buildAck(msg, code, outcome, opts.now),
      code,
      status: opts.dryRun && status === "accepted" ? "dry-run" : status,
      outcome,
      segments: msg?.segments.map((s) => ({ name: s.name, fields: s.f.slice(1) })) ?? [],
      ...extra,
    };
  };

  try {
    msg = parseMessage(text);
  } catch (e) {
    if (e instanceof Hl7ParseError) return done(AR, e.message);
    throw e;
  }
  const d = msg.delims;
  const [type, trigger] = [val(msg.segments[0], 9, d, 1), val(msg.segments[0], 9, d, 2)];
  if (type !== "ORU" || trigger !== "R01") return done(AR, `Unsupported message type ${type}^${trigger}`);
  const controlId = val(msg.segments[0], 10, d);
  if (!controlId) return done(AR, "MSH-10 (message control id) is required");
  if (await deps.alreadyAccepted(controlId))
    return done("AA", "Duplicate message control id; nothing written", { status: "duplicate" });

  const ihi = ihiOf(msg);
  if (!ihi) return done("AE", "PID-3 has no IHI (identifier type NI)");
  const ids = await deps.findPatientIds(patientQuery(ihi));
  if (ids.length !== 1)
    return done(
      "AE",
      ids.length
        ? "More than one patient has that IHI"
        : "No patient has that IHI. Patients are never created.",
    );

  let bundle: Bundle;
  try {
    bundle = mapOru(msg, ids[0]);
  } catch (e) {
    if (e instanceof Hl7MapError) return done(AR, e.message);
    throw e;
  }
  const errors = await deps.validate(bundle);
  if (errors.length)
    return done("AE", `FHIR validation failed: ${errors[0]}`, { bundle, validation: errors });
  if (!opts.dryRun) await deps.write(bundle);
  return done("AA", opts.dryRun ? "Valid; dry run, nothing written" : "Written", { bundle, validation: [] });
}
