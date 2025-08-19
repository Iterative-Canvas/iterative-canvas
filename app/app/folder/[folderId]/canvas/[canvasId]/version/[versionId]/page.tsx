export default async function App() {
  await sleep(2000)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 items-center justify-center">
        <h1 className="text-2xl font-bold">Create a canvas to get started</h1>
      </div>
    </div>
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
