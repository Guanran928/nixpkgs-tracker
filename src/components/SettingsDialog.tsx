import { useState } from "react";
import { Settings } from "lucide-react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function SettingsDialog({
  token,
  setToken,
}: {
  token: string;
  setToken: (t: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button aria-label="Settings" size="icon" variant="outline">
          <Settings />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            localStorage.setItem("token", token);
            setIsOpen(false);
            toast("GitHub token saved in browser localStorage.");
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit settings</DialogTitle>
            <DialogDescription>
              Make changes to your settings here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Label htmlFor="token">GitHub Token</Label>
            <Input
              id="token"
              name="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_..."
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
