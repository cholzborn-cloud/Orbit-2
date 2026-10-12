import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    {/* Zugeklappt, sonst liegt die leere Sidebar (fixed) über der Sidebar aus dem Root-Layout. */}
    <SidebarProvider defaultOpen={false}>
      <DashboardSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
