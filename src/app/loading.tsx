export default function Loading() {
  return (
    <main className="container-shell py-24" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-28 animate-pulse rounded bg-surface-muted" />
      <div className="mt-5 h-14 max-w-xl animate-pulse rounded-xl bg-surface-muted" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
    </main>
  );
}
