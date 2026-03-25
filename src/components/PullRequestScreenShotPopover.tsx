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
import { AnimatePresence, motion } from "motion/react";

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
  const [count, setCount] = useState(0);

  async function handleClick() {
    await onClick();
    setCount((c) => c + 1);
    trigger();
  }

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      className="relative flex-1 overflow-hidden"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={done ? count : "idle"}
          className="flex items-center gap-2"
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
          transition={{ duration: 0.15 }}
        >
          {done ? (
            <>
              <Check /> {doneLabel}
            </>
          ) : (
            <>
              {icon} {label}
            </>
          )}
        </motion.span>
      </AnimatePresence>
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
