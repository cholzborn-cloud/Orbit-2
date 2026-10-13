"use client";

import { UserButton } from "@clerk/nextjs";

import { SidebarMenuButton } from "@/components/ui/sidebar";

// Ganze Zeile öffnet das Clerk-Menü: Klicks außerhalb des Avatars lösen den Avatar-Button aus.
export function UserMenuButton() {
  return (
    <SidebarMenuButton
      size="lg"
      render={<div />}
      className="h-14 cursor-pointer rounded-xl group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full"
      onClick={(e) => {
        const trigger = e.currentTarget.querySelector("button");
        if (trigger && !trigger.contains(e.target as Node)) trigger.click();
      }}
    >
      <UserButton
        showName
        appearance={{
          elements: {
            // order! statt Reihenfolge im DOM: Avatar links, Name rechts.
            userButtonBox: "flex-row! gap-3",
            userButtonTrigger: "order-first!",
            userButtonOuterIdentifier:
              "order-last! text-sm font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden",
          },
        }}
      />
    </SidebarMenuButton>
  );
}
