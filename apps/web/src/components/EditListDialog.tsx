import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateListMutation } from "@/hooks/use-lists";
import type { List } from "@lyco/shared";
import { useState } from "react";

export interface EditListDialogProps {
  list: List;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditListDialog({
  list,
  open,
  onOpenChange,
}: EditListDialogProps) {
  const [name, setName] = useState(list.name);
  const [color, setColor] = useState(list.color);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { mutate, isPending, error } = useUpdateListMutation();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError("名称不能为空");
      return;
    }
    setValidationError(null);
    mutate(
      {
        id: list.id,
        input: { name: trimmed, color, expectedVersion: list.version },
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  }

  const errorMessage = validationError ?? error?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑列表</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-list-name">名称</Label>
            <Input
              id="edit-list-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-list-color">颜色</Label>
            <Input
              id="edit-list-color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-11 w-20 cursor-pointer p-1"
            />
          </div>
          {errorMessage && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <Button type="submit" disabled={isPending}>
            保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
