import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.js";
import { Input } from "@/components/ui/input.js";
import { Label } from "@/components/ui/label.js";
import { useCreateListMutation } from "@/hooks/use-lists.js";
import { DEFAULT_LIST_COLOR, randomListColor } from "@/lib/list-colors.js";
import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function NewListDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_LIST_COLOR);
  const { mutate, isPending, error } = useCreateListMutation();
  const isColorValid = HEX_COLOR_PATTERN.test(color);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !isColorValid) return;

    mutate(
      { name: trimmed, color, order: 0 },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setColor(DEFAULT_LIST_COLOR);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 px-3">
          <Plus className="h-4 w-4" />
          新建列表
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建列表</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="list-name">名称</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="列表名称"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="list-color">颜色</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="随机颜色"
                onClick={() => setColor(randomListColor(color))}
                className="flex h-9 w-16 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-200"
                style={{
                  backgroundColor: isColorValid ? color : undefined,
                }}
              >
                <RefreshCw className="h-4 w-4 text-white mix-blend-difference" />
              </button>
              <Input
                id="list-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error.message}</p>}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isPending || !name.trim() || !isColorValid}
            >
              创建
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
