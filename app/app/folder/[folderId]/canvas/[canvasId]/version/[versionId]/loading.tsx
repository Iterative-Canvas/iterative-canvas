export default function Loading() {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Loading dashboard...</h2>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )
}
