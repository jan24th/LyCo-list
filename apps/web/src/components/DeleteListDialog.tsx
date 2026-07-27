import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteListMutation } from "@/hooks/use-lists";
import type { List } from "@lyco/shared";

export interface DeleteListDialogProps {
  list: List;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (list: List) => void;
}

export function DeleteListDialog({
  list,
  open,
  onOpenChange,
  onDeleted,
}: DeleteListDialogProps) {
  const { mutate, isPending, error } = useDeleteListMutation();

  function handleConfirm() {
    mutate(
      { id: list.id, expectedVersion: list.version },
      {
        onSuccess: (deletedList) => {
          onOpenChange(false);
          onDeleted(deletedList);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除列表</DialogTitle>
          <DialogDescription>
            确定要删除列表「{list.name}」吗？其中的任务将不再显示。
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error.message}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
