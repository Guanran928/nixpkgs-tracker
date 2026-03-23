import { useEffect, useState } from "react";

export function useIsOverflowing<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
) {
  const [overflowLeft, setOverflowLeft] = useState(false);
  const [overflowRight, setOverflowRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      setOverflowLeft(el.scrollLeft > 0);
      setOverflowRight(el.scrollWidth - el.scrollLeft > el.clientWidth);
    };

    const observer = new ResizeObserver(check);
    observer.observe(el);
    el.addEventListener("scroll", check);
    check();

    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, []);

  return { overflowLeft, overflowRight };
}
