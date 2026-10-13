export default function ChatsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex h-svh flex-col">{children}</div>;
}
