import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateListMutation } from "@/hooks/use-lists";
import { Plus } from "lucide-react";
import { useState } from "react";

const DEFAULT_COLOR = "#3b82f6";

export function NewListDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const { mutate, isPending, error } = useCreateListMutation();

  const trimmedName = name.trim();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmedName) {
      return;
    }
    mutate(
      { name: trimmedName, color, order: 0 },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setColor(DEFAULT_COLOR);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2">
          <Plus className="size-4" />
          新建列表
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建列表</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-list-name">名称</Label>
            <Input
              id="new-list-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="列表名称"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-list-color">颜色</Label>
            <Input
              id="new-list-color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-11 w-20 cursor-pointer p-1"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          )}
          <Button type="submit" disabled={isPending || !trimmedName}>
            创建
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
