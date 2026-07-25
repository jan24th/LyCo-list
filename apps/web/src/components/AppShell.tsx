import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { type MouseEvent, type ReactNode, useEffect, useState } from "react";

export interface AppShellProps {
  title: string;
  navigation: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, navigation, children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 64rem)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    media.addEventListener("change", closeAtDesktop);
    return () => media.removeEventListener("change", closeAtDesktop);
  }, []);

  function closeAfterNavigation(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as Element;
    if (target.closest("a, [data-navigation-item]")) {
      setOpen(false);
    }
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <aside
        data-testid="desktop-navigation"
        className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:flex"
      >
        <div className="px-4 py-4 text-lg font-semibold">LyCo-list</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3">{navigation}</div>
      </aside>
      <div className="min-w-0 lg:pl-72">
        <header
          data-testid="mobile-header"
          className="sticky top-0 z-40 flex border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden"
        >
          <div className="flex min-h-14 min-w-0 flex-1 items-center gap-2 px-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label="打开导航"
                >
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[min(20rem,calc(100vw-2rem))] overflow-y-auto pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
              >
                <SheetHeader>
                  <SheetTitle>导航</SheetTitle>
                </SheetHeader>
                <div className="px-4" onClick={closeAfterNavigation}>
                  {navigation}
                </div>
              </SheetContent>
            </Sheet>
            <h1 className="truncate text-lg font-semibold">{title}</h1>
          </div>
        </header>
        <main className="min-w-0 overflow-x-hidden pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
          {children}
        </main>
      </div>
    </div>
  );
}
