import { Button } from "@/components/ui/button";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div>
      <h2 className="text-xl font-bold">今天</h2>
      <p className="mt-2 text-slate-600">智能列表占位页</p>
      <Link to="/about" className="mt-4 inline-block">
        <Button>关于</Button>
      </Link>
    </div>
  );
}
