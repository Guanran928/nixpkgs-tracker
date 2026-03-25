import { Download, Copy, Camera, Check } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toPng } from "html-to-image";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";

function useTimedState(duration = 1500) {
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function trigger() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActive(true);
    timeoutRef.current = setTimeout(() => setActive(false), duration);
  }

  return [active, trigger] as const;
}

function spanClass(visible: boolean) {
  return `transition-all duration-200 ${visible ? "blur-0 scale-100 opacity-100" : "scale-80 opacity-0 blur-sm"}`;
}

function AnimatedButton({
  onClick,
  icon,
  label,
  doneLabel,
}: {
  onClick: () => Promise<void>;
  icon: ReactNode;
  label: string;
  doneLabel: string;
}) {
  const [done, trigger] = useTimedState();

  async function handleClick() {
    await onClick();
    trigger();
  }

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      className="relative flex-1 overflow-hidden"
    >
      <span className={`flex items-center gap-2 ${spanClass(!done)}`}>
        {icon} {label}
      </span>
      <span
        className={`absolute inset-0 flex items-center justify-center gap-2 ${spanClass(done)}`}
      >
        <Check /> {doneLabel}
      </span>
    </Button>
  );
}

export default function PullRequestScreenShotPopover({
  children,
}: {
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  async function getDataUrl() {
    if (!ref.current) throw new Error("ref is null");
    return toPng(ref.current, { cacheBust: true });
  }

  async function handleCopy() {
    const blob = await fetch(await getDataUrl()).then((r) => r.blob());
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }

  async function handleSave() {
    Object.assign(document.createElement("a"), {
      download: "status.png",
      href: await getDataUrl(),
    }).click();
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs">
          <Camera /> Screenshot
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-auto space-y-4">
        <PopoverHeader>
          <PopoverTitle>Screenshot</PopoverTitle>
          <PopoverDescription>
            Take a screenshot of your pull request.
          </PopoverDescription>
        </PopoverHeader>
        <Card ref={ref} className="shadow-none w-96">
          <CardContent>{children}</CardContent>
        </Card>
        <ButtonGroup className="w-full">
          <AnimatedButton
            onClick={handleCopy}
            icon={<Copy />}
            label="Copy"
            doneLabel="Copied"
          />
          <AnimatedButton
            onClick={handleSave}
            icon={<Download />}
            label="Save"
            doneLabel="Downloaded"
          />
        </ButtonGroup>
      </PopoverContent>
    </Popover>
  );
}
