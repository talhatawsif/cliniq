"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { decide } from "@/lib/pipeline/review";
import { currentUserId } from "@/lib/supabase";

export type State = { error?: string; done?: string } | null;

const input = z.object({
  id: z.uuid(),
  decision: z.enum(["confirm", "change", "reject"]),
  newCode: z
    .string()
    .regex(/^\d{5,18}$/)
    .optional(),
});

export async function review(_prev: State, form: FormData): Promise<State> {
  const user = await currentUserId();
  if (!user) return { error: "Sign in required" };
  const parsed = input.safeParse({
    id: form.get("id"),
    decision: form.get("decision"),
    newCode: form.get("newCode") || undefined,
  });
  if (!parsed.success) return { error: "Invalid request" };
  try {
    await decide(parsed.data.id, parsed.data.decision, user, parsed.data.newCode);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The decision failed" };
  }
  revalidatePath("/review");
  return { done: parsed.data.decision };
}
