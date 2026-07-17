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
import { Plus } from "lucide-react";
import { useState } from "react";

export function NewListDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [icon, setIcon] = useState("list");
  const { mutate, isPending, error } = useCreateListMutation();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    mutate(
      { name: trimmed, color, icon, order: 0 },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setColor("#3b82f6");
          setIcon("list");
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
          <div>
            <Label htmlFor="list-name">名称</Label>
            <Input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="列表名称"
            />
          </div>
          <div>
            <Label htmlFor="list-color">颜色</Label>
            <Input
              id="list-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="list-icon">图标</Label>
            <Input
              id="list-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="list"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error.message}</p>}
          <Button type="submit" disabled={isPending || !name.trim()}>
            创建
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
