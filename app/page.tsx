import { PlusIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function Page() {
  return (
    <main className="flex min-h-[calc(100svh-3.5rem)]">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <Avatar className="size-20">
              <AvatarImage src="/favicon.ico" alt="Orbi" />
              <AvatarFallback>O</AvatarFallback>
            </Avatar>
          </EmptyMedia>
          <EmptyTitle>Mach’s, erstelle deinen ersten Orbit.</EmptyTitle>
          <EmptyDescription>
            Gib ihm Namen, Farbe und Aufgabe. Danach kannst du direkt loschatten.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="lg" className="rounded-full px-5">
            <PlusIcon data-icon="inline-start" />
            Erstelle einen neuen Orbi
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
