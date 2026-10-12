import { PlusIcon } from "lucide-react";
import { BotDialog } from "@/components/bot-dialog";
import { ChatAvatar } from "@/components/chat-avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="flex min-h-[calc(100svh-3.5rem)]">
      <Empty className="gap-6">
        <EmptyHeader className="gap-3">
          <EmptyMedia>
            <ChatAvatar seed={crypto.randomUUID()} animated className="size-20" />
          </EmptyMedia>
          <EmptyTitle className="text-xl">Dein erster Orbi wartet schon auf dich</EmptyTitle>
          <EmptyDescription className="text-xs">
            Gib ihm Namen, Farbe und Aufgabe. Danach kannst du direkt loschatten.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <BotDialog
            trigger={
              <Button size="lg" className="rounded-full px-5">
                <PlusIcon data-icon="inline-start" />
                Erstelle deinen ersten Orbi
              </Button>
            }
          />
        </EmptyContent>
      </Empty>
    </main>
  );
}
