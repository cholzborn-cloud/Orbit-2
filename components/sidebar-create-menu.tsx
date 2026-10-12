"use client";

import { PlusIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { BotDialog } from "@/components/bot-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SidebarCreateMenu() {
  const [creatingBot, setCreatingBot] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button size="icon" variant="outline" className="rounded-full" aria-label="Neu erstellen" />}
        >
          <PlusIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto">
          <DropdownMenuItem onClick={() => setCreatingBot(true)}>
            <PlusIcon /> Neuen Bot erstellen
          </DropdownMenuItem>
          {/* Öffnet bewusst nichts. */}
          <DropdownMenuItem>
            <UsersIcon /> Gruppe erstellen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BotDialog open={creatingBot} onOpenChange={setCreatingBot} />
    </>
  );
}
