import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import type { EditableBot } from "@/components/bot-dialog";
import { Chat } from "@/components/chat";
import { GroupSidePanel } from "@/components/group-side-panel";
import { ChatSidePanel } from "@/components/chat-side-panel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { getAvailableModels } from "@/lib/chat-models";
import { db } from "@/lib/db";
import { bots, chatMembers, chats } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getChat } from "@/query/chat";

// Alle Orbis des Nutzers samt Direktchat (für Chat- und Bearbeiten-Knopf im Gruppenpanel).
async function groupBots(userId: string) {
  const [rows, direct] = await Promise.all([
    db.select().from(bots).where(eq(bots.userId, userId)),
    db
      .select({ chatId: chats.id, botId: chatMembers.botId })
      .from(chats)
      .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
      .where(and(eq(chats.userId, userId), eq(chats.kind, "direct"))),
  ]);
  const chatOf = new Map(direct.map((d) => [d.botId, d.chatId]));
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    avatar: b.avatar as EditableBot["avatar"],
    color: b.color,
    job: b.job,
    instructions: b.instructions ?? "",
    isMain: b.isMain,
    chatId: chatOf.get(b.id) ?? null,
  }));
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) notFound();

  const { chatId } = await params;
  const chat = await getChat(userId, chatId);
  // Direktchat: das einzige Mitglied. Gruppe: erstes Mitglied als Standard-Orbi.
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

  const isGroup = chat.kind === "group";

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
          title={isGroup ? (chat.name ?? "Gruppe") : undefined}
          // Kopfzeile zeigt alle Mitglieder als Gruppen-Avatar; Gruppe wählt daraus den Orbi je Nachricht.
          members={chat.members.map((m) => ({
            id: m.bot.id,
            name: m.bot.name,
            job: m.bot.job,
            isMain: m.bot.isMain,
            avatar: m.bot.avatar,
            color: m.bot.color,
          }))}
        />
      </ResizablePanel>
      <ResizableHandle />
      {isGroup ? (
        <GroupSidePanel
          key={chatId}
          chatId={chatId}
          name={chat.name ?? "Gruppe"}
          memberIds={chat.members.map((m) => m.bot.id)}
          allBots={await groupBots(userId)}
        />
      ) : (
        <ChatSidePanel key={chatId} bot={editable} chatId={chatId} />
      )}
    </ResizablePanelGroup>
  );
}
