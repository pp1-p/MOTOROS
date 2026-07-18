import type {
  HTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

export const publicFormInputClass =
  "h-12 w-full rounded-xl border bg-white px-3.5 text-sm text-foreground shadow-sm transition placeholder:text-foreground/40 focus:border-brand disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70";

export const publicFormTextareaClass =
  "min-h-32 w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-sm text-foreground shadow-sm transition placeholder:text-foreground/40 focus:border-brand disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70";

export function Field({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-2", className)} {...props} />;
}

export function FieldLabel({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-extrabold text-foreground/85", className)}
      {...props}
    />
  );
}

export function FieldHint({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs leading-5 text-foreground/50", className)} {...props} />
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs font-bold text-danger">
      {message}
    </p>
  );
}

export function PublicSelect({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(publicFormInputClass, className)} {...props}>
      {children}
    </select>
  );
}

export function ConsentField({
  id,
  label,
  error,
  ...props
}: {
  id: string;
  label: React.ReactNode;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 text-sm leading-6 text-foreground/70"
      >
        <input
          id={id}
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-brand"
          {...props}
        />
        <span>{label}</span>
      </label>
      <FieldError message={error} />
    </div>
  );
}

export function HoneypotField({
  registerProps,
}: {
  registerProps: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-[10000px] size-px overflow-hidden"
    >
      <label htmlFor="website">
        Company website
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...registerProps}
        />
      </label>
    </div>
  );
}
