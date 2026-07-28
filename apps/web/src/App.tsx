import { AppShell } from "@/components/AppShell";
import { Sidebar } from "@/components/Sidebar";
import { InstallPrompt } from "@/pwa/InstallPrompt";
import { Outlet, useRouterState } from "@tanstack/react-router";

export default function App() {
  const title = useRouterState({
    select: (state) => state.matches[state.matches.length - 1].staticData.title,
  });
  return (
    <>
      <AppShell title={title} navigation={<Sidebar />}>
        <Outlet />
      </AppShell>
      <InstallPrompt />
    </>
  );
}
