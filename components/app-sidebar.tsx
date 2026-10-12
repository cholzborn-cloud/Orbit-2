import { auth } from "@clerk/nextjs/server";

import { UserMenuButton } from "@/components/user-menu-button";
import { SidebarNav } from "@/components/sidebar-nav";
import {
  Sidebar,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getSidebarBots } from "@/query/bot";

export async function AppSidebar() {
  const { userId } = await auth();
  if (!userId) return null;

  const { main, bots } = await getSidebarBots(userId);

  return (
    <Sidebar collapsible="icon">
      <SidebarNav main={main} bots={bots} />
      <SidebarFooter className="shrink-0 px-3 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenuButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
