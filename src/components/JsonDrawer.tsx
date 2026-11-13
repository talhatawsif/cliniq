"use client";

import type { Resource } from "fhir/r4";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";

const Ctx = createContext<(r: Resource) => void>(() => {});

// Colour only through tokens: keys accent, strings default, numbers and literals muted.
function Highlighted({ json }: { json: string }) {
  const parts = json.split(
    /("(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
  );
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 0 ? (
          p
        ) : p.endsWith(":") ? (
          <span key={i} className="text-accent">
            {p}
          </span>
        ) : /^["]/.test(p) ? (
          <span key={i}>{p}</span>
        ) : (
          <span key={i} className="text-muted">
            {p}
          </span>
        ),
      )}
    </>
  );
}

/** One right-hand drawer for the whole chart; the patient banner is repeated at its top. */
export function JsonDrawerProvider({ banner, children }: { banner: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [resource, setResource] = useState<Resource | null>(null);
  const [copied, setCopied] = useState(false);
  const json = resource ? JSON.stringify(resource, null, 2) : "";

  return (
    <Ctx.Provider
      value={(r) => {
        setResource(r);
        setCopied(false);
        ref.current?.showModal();
      }}
    >
      {children}
      <dialog
        ref={ref}
        aria-labelledby="json-title"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="m-0 ml-auto h-full max-h-none w-full max-w-2xl border-l border-line-strong bg-surface p-0 text-fg backdrop:bg-black/40"
      >
        <div className="flex h-full flex-col">
          <p className="tabular border-b border-line bg-sunken px-4 py-2 text-[13px]">{banner}</p>
          <div className="flex items-center gap-3 border-b border-line px-4 py-2">
            <h2 id="json-title" className="flex-1 font-mono text-[13px] font-medium">
              {resource ? `${resource.resourceType}/${resource.id}` : ""}
            </h2>
            <button
              type="button"
              className="h-8 rounded border border-line-strong px-3"
              onClick={async () => {
                await navigator.clipboard.writeText(json);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <button
              type="button"
              className="h-8 rounded border border-line-strong px-3"
              onClick={() => ref.current?.close()}
            >
              Close
            </button>
          </div>
          <pre className="flex-1 overflow-auto p-4 font-mono text-[13px] leading-5" tabIndex={0}>
            <Highlighted json={json} />
          </pre>
        </div>
      </dialog>
    </Ctx.Provider>
  );
}

export function JsonButton({ resource, label }: { resource: Resource; label: string }) {
  const open = useContext(Ctx);
  return (
    <button
      type="button"
      onClick={() => open(resource)}
      className="text-accent underline"
      aria-label={`View FHIR JSON for ${label}`}
    >
      View FHIR JSON
    </button>
  );
}

/** Opens the chart's FHIR JSON drawer for a resource. */
export const useJsonDrawer = () => useContext(Ctx);
