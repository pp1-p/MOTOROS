import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container-shell grid min-h-[70vh] place-items-center py-24 text-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">Hmm</p>
        <h1 className="mt-3 font-display text-5xl">We couldn&apos;t find that page.</h1>
        <p className="mx-auto mt-4 max-w-md text-foreground/65">
          Maybe the car has been snapped up, or the link&apos;s a bit old. Have
          a look at what we&apos;ve got now — or give us a ring, we love a chat.
        </p>
        <Link
          href="/cars"
          className="mt-7 inline-flex rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-strong"
        >
          See our cars
        </Link>
      </div>
    </main>
  );
}
