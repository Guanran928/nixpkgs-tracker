import { useCallback, useRef, useState } from "react";

export function useIsOverflowing<T extends HTMLElement>() {
  const [overflowLeft, setOverflowLeft] = useState(false);
  const [overflowRight, setOverflowRight] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: T | null) => {
    observerRef.current?.disconnect();
    if (!el) return;

    const check = () => {
      setOverflowLeft(el.scrollLeft > 0);
      setOverflowRight(el.scrollWidth - el.scrollLeft > el.clientWidth);
    };

    observerRef.current = new ResizeObserver(check);
    observerRef.current.observe(el);
    el.addEventListener("scroll", check);
    check();

    return () => {
      observerRef.current?.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, []);

  return { ref, overflowLeft, overflowRight };
}
