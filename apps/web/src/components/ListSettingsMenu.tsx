import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { List } from "@lyco/shared";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";

export interface ListSettingsMenuProps {
  list: List;
  onEdit: (list: List) => void;
  onDelete: (list: List) => void;
}

export function ListSettingsMenu({
  list,
  onEdit,
  onDelete,
}: ListSettingsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 lg:size-8"
          aria-label="列表设置"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(list)}>
          <Pencil className="size-4" />
          编辑
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(list)}>
          <Trash className="size-4" />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
