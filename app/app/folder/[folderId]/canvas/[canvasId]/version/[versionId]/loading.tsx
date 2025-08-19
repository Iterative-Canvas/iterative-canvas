export default function Loading() {
  return (
    <div className="flex h-full min-h-screen flex-col">
      {/* Header */}
      <header className="flex h-16 items-center border-b px-4">
        <div className="h-5 w-44 rounded-md bg-muted animate-pulse" />
      </header>

      {/* Body */}
      <main className="flex-1 min-h-0 p-4">
        <div className="grid h-full min-h-[calc(100vh-4rem-2rem)] grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="grid h-full grid-rows-2 gap-4">
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
          <SkeletonBlock />
        </div>
      </main>
    </div>
  )
}

function SkeletonBlock() {
  return (
    <section className="h-full rounded-lg border p-4">
      <div className="space-y-3">
        <div className="h-4 w-1/3 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-11/12 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-3/4 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-10/12 rounded-md bg-muted animate-pulse" />
      </div>
    </section>
  )
}
