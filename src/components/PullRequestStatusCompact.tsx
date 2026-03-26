import type {
  PullRequestBranchStatus,
  PullRequestMetadata,
} from "./PullRequestStatus";
import type { components } from "@octokit/openapi-types";

import { useIsOverflowing } from "@/hooks/use-is-overflowing";
import { BellRing, BellOff, Check, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatePresence, motion } from "motion/react";

type PullRequestInformation = components["schemas"]["pull-request"];

export default function PullRequestStatusCompact({
  pullRequestInformation,
  pullRequestBranchStatus,
  setTrackingPullRequests,
  tracked,
}: {
  pullRequestInformation: PullRequestInformation | null;
  pullRequestBranchStatus: PullRequestBranchStatus[] | null;
  setTrackingPullRequests: React.Dispatch<
    React.SetStateAction<PullRequestMetadata[]>
  >;
  tracked: boolean;
}) {
  const ref = useRef(null);
  const { overflowLeft, overflowRight } = useIsOverflowing(ref);

  return (
    <>
      {pullRequestInformation && (
        <div className="group relative" tabIndex={0}>
          <h4 className="flex scroll-m-20 justify-between font-semibold tracking-tight">
            <a
              href={pullRequestInformation.html_url}
              className="decoration-opacity-0 hover:decoration-opacity-100 break-all underline decoration-transparent transition-colors duration-200 ease-in-out hover:decoration-current"
            >
              {pullRequestInformation.title}
            </a>{" "}
            <span className="text-muted-foreground">
              #{pullRequestInformation.number}
            </span>
          </h4>

          {pullRequestInformation.state == "open" && (
            <Badge variant="secondary">Not merged</Badge>
          )}

          {pullRequestInformation.state == "closed" && (
            <div className="relative">
              <AnimatePresence>
                {overflowLeft && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="from-card pointer-events-none absolute inset-y-0 left-0 w-6 bg-linear-to-r to-transparent"
                  />
                )}
              </AnimatePresence>

              <ul
                className="no-scrollbar flex space-x-1 overflow-x-auto whitespace-nowrap"
                style={{ scrollbarWidth: "none" }}
                ref={ref}
              >
                {pullRequestBranchStatus ? (
                  // merged branches are sorted to the front
                  (() => {
                    const merged = pullRequestBranchStatus.filter(
                      (b) => b.status === "merged",
                    );
                    const others = pullRequestBranchStatus.filter(
                      (b) => b.status !== "merged",
                    );

                    const getVariant = (
                      status: PullRequestBranchStatus["status"],
                    ) => {
                      switch (status) {
                        case "merged":
                          return "default";
                        case "not-merged":
                          return "secondary";
                        case "fetch-error":
                          return "destructive";
                      }
                    };

                    const getIcon = (
                      status: PullRequestBranchStatus["status"],
                    ) => {
                      switch (status) {
                        case "merged":
                          return <Check />;
                        case "not-merged":
                          return <></>;
                        case "fetch-error":
                          return <CircleAlert />;
                      }
                    };

                    return [...merged, ...others].map((branch) => (
                      <li key={branch.branch}>
                        <Badge variant={getVariant(branch.status)}>
                          {getIcon(branch.status)}
                          {branch.branch}
                        </Badge>
                      </li>
                    ));
                  })()
                ) : (
                  // FIXME
                  <>
                    <div className="flex justify-between">
                      <Skeleton className="h-6 w-[120px]" />
                      <Skeleton className="h-6 w-[60px]" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-6 w-[100px]" />
                      <Skeleton className="h-6 w-[80px]" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-6 w-[140px]" />
                      <Skeleton className="h-6 w-[60px]" />
                    </div>
                  </>
                )}
              </ul>

              <AnimatePresence>
                {overflowRight && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="from-card pointer-events-none absolute inset-y-0 right-0 w-6 bg-linear-to-l to-transparent"
                  />
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Track & Untrack */}
          {/* FIXME: this is not really working on mobile */}
          <div className="bg-background absolute top-1/2 right-2 -translate-y-1/2 rounded-md opacity-0 transition duration-75 group-focus-within:opacity-100 group-hover:opacity-100">
            {tracked ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTrackingPullRequests((currentTracking) =>
                    currentTracking.filter(
                      (pr) =>
                        pr.pullRequestNumber !== pullRequestInformation.number,
                    ),
                  );
                  toast.success(
                    `Stopped tracking PR #${pullRequestInformation.number}`,
                  );
                }}
              >
                <BellOff />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTrackingPullRequests((currentTracking) => {
                    const alreadyExists = currentTracking.find(
                      (obj) =>
                        obj.pullRequestNumber === pullRequestInformation.number,
                    );

                    if (alreadyExists) {
                      toast("Pull request is already being tracked");
                      return currentTracking;
                    } else {
                      const newItem = {
                        pullRequestNumber: pullRequestInformation.number,
                      } as PullRequestMetadata;
                      return [...currentTracking, newItem];
                    }
                  });
                }}
              >
                <BellRing />
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
