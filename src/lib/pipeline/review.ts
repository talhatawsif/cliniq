import "server-only";
import type { Condition } from "fhir/r4";
import { audit } from "@/lib/audit";
import { fhirFetch } from "@/lib/fhir/client";
import { validateBundle, writeBundle } from "@/lib/fhir/write";
import { admin } from "@/lib/supabase";
import { type Decision, buildDecision } from "./build";

export type Alternative = { code: string; display: string; confidence: number; rationale: string };
export type ReviewItem = {
  id: string;
  created: string;
  patient_id: string;
  document_id: string;
  condition_id: string;
  term: string;
  span_start: number;
  span_end: number;
  code: string;
  display: string;
  confidence: number;
  rationale: string;
  alternatives: Alternative[];
  engine: string;
  status: "pending" | "confirmed" | "changed" | "rejected";
  decided_at: string | null;
};

export async function listReview() {
  const { data, error } = await admin()
    .from("review_items")
    .select("*")
    .order("created", { ascending: false })
    .limit(100);
  if (error) throw new Error(`review queue read failed: ${error.code}`);
  const items = (data ?? []) as ReviewItem[];
  return {
    pending: items.filter((i) => i.status === "pending"),
    decided: items.filter((i) => i.status !== "pending").slice(0, 20),
  };
}

const STATUS = { confirm: "confirmed", change: "changed", reject: "rejected" } as const;

/** Applies a reviewer's decision to one pending item. `newCode` must be one of the item's alternatives. */
export async function decide(itemId: string, decision: Decision, userId: string, newCode?: string) {
  const db = admin();
  const { data } = await db.from("review_items").select("*").eq("id", itemId).single();
  const item = data as ReviewItem | null;
  if (!item) throw new Error("Review item not found");
  if (item.status !== "pending") throw new Error("This item has already been reviewed");

  let alternative: Alternative | undefined;
  if (decision === "change") {
    alternative = item.alternatives.find((a) => a.code === newCode);
    if (!alternative) throw new Error("Choose one of the suggested alternatives");
  }
  const condition = await fhirFetch<Condition>(`Condition/${item.condition_id}`);
  if (!condition) throw new Error("The Condition no longer exists");
  if (condition.verificationStatus?.coding?.[0]?.code !== "unconfirmed")
    throw new Error("The Condition was already changed");

  const bundle = buildDecision(
    condition,
    decision,
    new Date(),
    alternative && { code: alternative.code, display: alternative.display },
  );
  const errors = await validateBundle(bundle);
  if (errors.length) throw new Error(`FHIR validation failed: ${errors[0]}`);
  await writeBundle(bundle);

  // Only the first of two concurrent decisions gets here with status still "pending".
  await db
    .from("review_items")
    .update({ status: STATUS[decision], decided_by: userId, decided_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("status", "pending");
  await audit("review", `Condition/${item.condition_id}`, decision, "success", userId);
}
