import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UiPreview() {
  return (
    <section className="space-y-4 rounded-lg border bg-background p-4 text-foreground">
      <h2 className="font-semibold text-foreground">主题组件基线</h2>
      <div className="space-y-2">
        <Label htmlFor="preview-list-name">列表名称</Label>
        <Input id="preview-list-name" defaultValue="个人" />
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button>打开预览</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>组件预览</DialogTitle>
            <DialogDescription>
              验证 overlay 使用相同语义主题。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">关闭</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
