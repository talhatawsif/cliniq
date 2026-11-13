/** Only OpenRouter free models may be called: any other id throws before a request is made. */
export function assertFreeModel(id: string): string {
  if (!/^[\w.-]+\/[\w.:-]+$/.test(id) || !id.endsWith(":free"))
    throw new Error(`Model "${id}" is not a free model (:free)`);
  return id;
}

/** Parses OPENROUTER_MODELS. A paid id in the list is an error, not something to skip silently. */
export const parseModels = (list: string | undefined) =>
  (list ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(assertFreeModel);
