import Link from "next/link"

export default function Home() {
  return (
    <div className="flex flex-col font-sans">
      <b>Homepage</b>
      <Link href="/app">Go to App</Link>
      <Link href="/docs">Go to Docs</Link>
      <Link href="/blog">Go to Blog</Link>
    </div>
  )
}
