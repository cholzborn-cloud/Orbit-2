import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import type { EditableBot } from "@/components/bot-dialog";
import { ChatComposer } from "@/components/chat-composer";
import { ChatHeader } from "@/components/chat-header";
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
  if (!chat || !bot) notFound();

  return (
    <div className="flex min-h-svh flex-col">
      <ChatHeader
        bot={{
          id: bot.id,
          name: bot.name,
          avatar: bot.avatar as EditableBot["avatar"],
          color: bot.color,
          job: bot.job,
          instructions: bot.instructions ?? "",
          isMain: bot.isMain,
        }}
      />
      <div className="flex-1" />
      <ChatComposer />
    </div>
  );
}
