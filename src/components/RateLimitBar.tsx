import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/context/SettingsContext";

export type RateLimitState = {
  remaining: number | null;
  resetTimestamp: number | null;
};

export default function RateLimitBar({
  rateLimit,
  setRateLimit,
}: {
  rateLimit: RateLimitState;
  setRateLimit: React.Dispatch<React.SetStateAction<RateLimitState>>;
}) {
  const { settings } = useSettings();

  useEffect(() => {
    setRateLimit({ remaining: null, resetTimestamp: null });
  }, [settings.token]);

  useEffect(() => {
    if (!rateLimit.resetTimestamp) return;

    const timeRemaining = rateLimit.resetTimestamp * 1000 - Date.now();
    if (timeRemaining <= 0) {
      setRateLimit({ remaining: null, resetTimestamp: null });
      return;
    }

    const timer = setTimeout(() => {
      setRateLimit({ remaining: null, resetTimestamp: null });
    }, timeRemaining);

    return () => clearTimeout(timer);
  }, [rateLimit.resetTimestamp]);

  return (
    <AnimatePresence>
      {!settings.token &&
        rateLimit.remaining != null &&
        rateLimit.resetTimestamp &&
        rateLimit.remaining < 100 && (
          <motion.div
            className="-z-10 flex flex-wrap justify-center gap-1"
            initial={{ height: 0, marginBottom: 0 }}
            animate={{ height: "auto", marginBottom: "12px" }}
            exit={{ height: 0, marginBottom: 0 }}
          >
            <Badge
              variant={rateLimit.remaining == 0 ? "destructive" : "default"}
            >
              <NumberFlow value={rateLimit.remaining} /> requests remaining
            </Badge>
            <Badge>
              Resets at{" "}
              {new Date(rateLimit.resetTimestamp * 1000).toLocaleTimeString()}
            </Badge>
          </motion.div>
        )}
    </AnimatePresence>
  );
}
