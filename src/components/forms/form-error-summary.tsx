"use client";

import { useEffect, useRef } from "react";

export function FormErrorSummary({ errors, submitCount, submitError }: {
  errors: Record<string, { message?: string } | undefined>;
  submitCount: number;
  submitError: string | null;
}) {
  const summary = useRef<HTMLDivElement>(null);
  const lastSubmission = useRef(0);
  const lastServerError = useRef<string | null>(null);
  const entries = Object.entries(errors).filter(([, error]) => error?.message);
  useEffect(() => {
    const newSubmission = submitCount !== lastSubmission.current;
    const newServerError = Boolean(submitError && submitError !== lastServerError.current);
    lastSubmission.current = submitCount;
    lastServerError.current = submitError;
    if ((newSubmission && entries.length > 0) || newServerError) summary.current?.focus();
  }, [submitCount, submitError, entries.length]);
  if (!entries.length && !submitError) return null;
  return (
    <div ref={summary} tabIndex={-1} role="alert" aria-label="Please check this form"
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 focus:outline-2 focus:outline-offset-2 focus:outline-red-700">
      <p className="font-extrabold">{submitError ?? "Please check the following details."}</p>
      {entries.length ? <ul className="mt-2 space-y-1">{entries.map(([name, error]) => (
        <li key={name}><button type="button" className="min-h-11 text-left font-semibold underline underline-offset-2"
          onClick={(event) => {
            const form = event.currentTarget.closest("form");
            const control = form?.elements.namedItem(name);
            if (control instanceof HTMLElement && control.getAttribute("type") !== "hidden") control.focus();
            else form?.querySelector<HTMLElement>(`[data-error-field="${CSS.escape(name)}"]`)?.focus();
          }}>{error?.message}</button></li>
      ))}</ul> : null}
    </div>
  );
}
