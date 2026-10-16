"use client";

import { UserButton } from "@clerk/nextjs";
import { GaugeIcon } from "lucide-react";
import { useState } from "react";

import { getProviderLimits } from "@/app/actions";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import type { ProviderLimits } from "@/lib/provider-limits";

const NAMES: Record<string, string> = { claude: "Claude", codex: "Codex", antigravity: "Antigravity" };

function rowLabel(limit: ProviderLimits & { ok: true }, i: number) {
  const { provider, windows } = limit.limits[i];
  const name = NAMES[provider] ?? provider;
  if (!windows.length) return `${name}: keine Daten`;
  const used = windows.map((w) => `${w.name} ${Math.round(w.used * 100)} %`).join(" · ");
  const reset = new Date(windows[0].resetAt).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return `${name}: ${used} · Reset ${reset}`;
}

// Ganze Zeile öffnet das Clerk-Menü: Klicks außerhalb des Avatars lösen den Avatar-Button aus.
export function UserMenuButton() {
  // undefined = noch nicht geladen
  const [limits, setLimits] = useState<ProviderLimits>();
  const noop = () => {};
  return (
    <SidebarMenuButton
      size="lg"
      render={<div />}
      className="h-14 cursor-pointer rounded-xl group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full"
      onClick={(e) => {
        const trigger = e.currentTarget.querySelector("button");
        if (trigger && !trigger.contains(e.target as Node)) trigger.click();
        // Menü öffnet: Limits neu holen (Server cached 60 s).
        getProviderLimits().then(setLimits, () => setLimits({ ok: false }));
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
      >
        <UserButton.MenuItems>
          {limits?.ok ? (
            limits.limits.map((_, i) => (
              <UserButton.Action key={i} label={rowLabel(limits, i)} labelIcon={<GaugeIcon className="size-4" />} onClick={noop} />
            ))
          ) : (
            <UserButton.Action
              label={limits ? "Limits: Proxy nicht erreichbar" : "Limits werden geladen …"}
              labelIcon={<GaugeIcon className="size-4" />}
              onClick={noop}
            />
          )}
        </UserButton.MenuItems>
      </UserButton>
    </SidebarMenuButton>
  );
}
