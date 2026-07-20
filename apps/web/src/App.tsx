import { Outlet } from "@tanstack/react-router";

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-border border-b p-4">
        <h1 className="text-lg font-semibold">LyCo-list</h1>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
