"use client";
import { useActionState, useState, useTransition } from "react";
import { enrolTotp, verifyTotp } from "./actions";

type Setup = { factorId: string; qr: string; secret: string };

export function MfaForm({ factorId }: { factorId: string | null }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [setupError, setSetupError] = useState("");
  const [starting, start] = useTransition();
  const [state, action, pending] = useActionState(verifyTotp, {});
  const id = factorId ?? setup?.factorId;

  if (!id)
    return (
      <div>
        <p className="mb-3 text-muted">
          Set up an authenticator app (any TOTP app) to finish signing in. You will use it every time.
        </p>
        <button
          type="button"
          disabled={starting}
          onClick={() =>
            start(async () => {
              const r = await enrolTotp();
              if ("error" in r) setSetupError(r.error);
              else setSetup(r);
            })
          }
          className="h-9 rounded border border-line-strong bg-surface px-4 font-semibold"
        >
          Set up authenticator
        </button>
        {setupError && (
          <p role="alert" className="mt-3 text-critical">
            {setupError}
          </p>
        )}
      </div>
    );

  return (
    <form action={action} className="flex flex-col gap-3">
      {setup && (
        <div>
          <p className="mb-2 text-muted">Scan this code with your authenticator app, then enter the 6 digits.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- an SVG data URI from the auth server */}
          <img src={setup.qr} alt="QR code for your authenticator app" width={180} height={180} />
          <p className="mt-2 text-[13px] text-muted">
            Cannot scan? Enter this key: <code>{setup.secret}</code>
          </p>
        </div>
      )}
      <input type="hidden" name="factorId" value={id} />
      <label className="flex flex-col gap-1">
        Code from your authenticator app
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          className="h-9 w-40 rounded border border-line-strong bg-surface px-2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-9 self-start rounded border border-line-strong bg-surface px-4 font-semibold"
      >
        Verify
      </button>
      {state.error && (
        <p role="alert" className="text-critical">
          {state.error}
        </p>
      )}
    </form>
  );
}
