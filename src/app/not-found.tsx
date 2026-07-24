import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container-shell grid min-h-[70vh] place-items-center py-24 text-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">404</p>
        <h1 className="mt-3 font-display text-5xl">That page has moved on.</h1>
        <p className="mx-auto mt-4 max-w-md text-foreground/65">
          The vehicle may have sold or the link may be out of date.
        </p>
        <Link
          href="/cars"
          className="mt-7 inline-flex rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-strong"
        >
          Browse current cars
        </Link>
      </div>
    </main>
  );
}
