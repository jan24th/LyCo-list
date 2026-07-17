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
import { DEFAULT_LIST_COLOR, LIST_COLORS } from "@/lib/list-colors.js";
import { Plus } from "lucide-react";
import { useState } from "react";

export function NewListDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_LIST_COLOR);
  const { mutate, isPending, error } = useCreateListMutation();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

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
            <Label>颜色</Label>
            <div className="flex gap-2">
              {LIST_COLORS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.name}
                  aria-pressed={color === option.value}
                  onClick={() => setColor(option.value)}
                  className={`h-7 w-7 rounded-full transition-shadow ${
                    color === option.value
                      ? "ring-2 ring-slate-900 ring-offset-2"
                      : ""
                  }`}
                  style={{ backgroundColor: option.value }}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error.message}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending || !name.trim()}>
              创建
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
