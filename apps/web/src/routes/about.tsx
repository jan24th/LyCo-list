import { Button } from "@/components/ui/button";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <div>
      <h2 className="text-xl font-bold">关于 LyCo-list</h2>
      <p className="mt-2 text-slate-600">家庭/小团队共享待办应用</p>
      <Link to="/" className="mt-4 inline-block">
        <Button variant="ghost">返回</Button>
      </Link>
    </div>
  );
}
