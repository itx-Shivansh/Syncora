export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-xl space-y-4">
        <span className="inline-flex items-center rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium uppercase tracking-wider text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          Syncora v0.1.0 • Scaffold Active
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Keep work in sync.</h1>
        <p className="text-base text-neutral-600 dark:text-neutral-400">
          Premium team project-management and operational-intelligence platform.
        </p>
      </div>
    </main>
  );
}
