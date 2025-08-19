import { AppProvider } from "@/providers/AppProvider"

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <AppProvider>{children}</AppProvider>
}
