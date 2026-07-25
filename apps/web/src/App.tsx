import { AppShell } from "@/components/AppShell";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";

function Navigation() {
  const classes =
    "flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-accent hover:text-accent-foreground";
  return (
    <nav aria-label="主导航" className="space-y-1">
      <Link to="/" className={classes}>
        首页
      </Link>
      <Link to="/about" className={classes}>
        关于
      </Link>
    </nav>
  );
}

export default function App() {
  const title = useRouterState({
    select: (state) => state.matches[state.matches.length - 1].staticData.title,
  });
  return (
    <AppShell title={title} navigation={<Navigation />}>
      <Outlet />
    </AppShell>
  );
}
