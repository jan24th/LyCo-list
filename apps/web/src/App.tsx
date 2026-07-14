import { buildResponse } from "@lyco/shared";

export default function App() {
  // Keep a reference to verify workspace linking works.
  const sample = buildResponse(200, { ok: true });

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">LyCo-list</h1>
      <p className="mt-2 text-sm">PWA 待办应用 {sample.statusCode}</p>
    </main>
  );
}
