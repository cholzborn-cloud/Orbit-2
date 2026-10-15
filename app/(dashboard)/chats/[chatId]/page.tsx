import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import type { EditableBot } from "@/components/bot-dialog";
import { Chat } from "@/components/chat";
import { ChatSidePanel } from "@/components/chat-side-panel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { getAvailableModels } from "@/lib/chat-models";
import { getChat } from "@/query/chat";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) notFound();

  const { chatId } = await params;
  const chat = await getChat(userId, chatId);
  // Gruppenchats vorerst ignoriert: es zählt das erste Mitglied.
  const bot = chat?.members[0]?.bot;
  // Gelöschter Orbi oder alte URL: zurück zur Startseite (dort "Neuer Orbi"), statt 404.
  if (!chat || !bot) redirect("/");
  const editable: EditableBot = {
    id: bot.id,
    name: bot.name,
    avatar: bot.avatar as EditableBot["avatar"],
    color: bot.color,
    job: bot.job,
    instructions: bot.instructions ?? "",
    isMain: bot.isMain,
  };

  return (
    // Links Chat (Header + Verlauf), rechts das Panel, das der Header auf- und zuklappt.
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel id="chat" minSize="40" className="flex flex-col">
        <Chat
          key={chatId}
          chatId={chatId}
          models={await getAvailableModels()}
          avatar={bot.avatar}
          color={bot.color}
          bot={editable}
          // Kopfzeile zeigt alle Mitglieder als Dots (max. 3 plus "+N").
          dots={chat.members.map((m) => ({ avatar: m.bot.avatar, color: m.bot.color }))}
        />
      </ResizablePanel>
      <ResizableHandle />
      <ChatSidePanel key={chatId} bot={editable} chatId={chatId} />
    </ResizablePanelGroup>
  );
}
