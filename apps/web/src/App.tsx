import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./components/Sidebar.js";

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
