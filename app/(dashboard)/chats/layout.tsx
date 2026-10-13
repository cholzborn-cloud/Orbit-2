import { ChatComposer } from "@/components/chat-composer";

// Der Composer liegt im Layout: er bleibt beim Chatwechsel stehen und lädt nicht neu.
export default function ChatsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <ChatComposer />
    </div>
  );
}
