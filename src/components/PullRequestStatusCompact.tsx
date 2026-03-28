import type {
  PullRequestBranchStatus,
  PullRequestMetadata,
} from "@/components/PullRequestStatus";
import type { components } from "@octokit/openapi-types";

import TrackPullRequestButton from "@/components/TrackPullRequestButton";
import { useIsOverflowing } from "@/hooks/use-is-overflowing";

import { Check, CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatePresence, motion } from "motion/react";

type PullRequestInformation = components["schemas"]["pull-request"];

export default function PullRequestStatusCompact({
  pullRequestNumber,
  pullRequestInformation,
  pullRequestBranchStatus,
  trackingPullRequestsFailed,
  setTrackingPullRequests,
  tracked,
}: {
  pullRequestNumber: number;
  pullRequestInformation: PullRequestInformation | null;
  pullRequestBranchStatus: PullRequestBranchStatus[] | null;
  trackingPullRequestsFailed: number[];
  setTrackingPullRequests: React.Dispatch<
    React.SetStateAction<PullRequestMetadata[]>
  >;
  tracked: boolean;
}) {
  const { ref, overflowLeft, overflowRight } = useIsOverflowing();

  return (
    <div className="group relative" tabIndex={0}>
      <h4 className="flex scroll-m-20 justify-between font-semibold tracking-tight">
        {pullRequestInformation ? (
          <a
            href={pullRequestInformation.html_url}
            className="decoration-opacity-0 hover:decoration-opacity-100 break-all underline decoration-transparent transition-colors duration-200 ease-in-out hover:decoration-current"
          >
            {pullRequestInformation.title}
          </a>
        ) : (
          <Skeleton className="h-5 w-[160px]" />
        )}
        <span className="text-muted-foreground">#{pullRequestNumber}</span>
      </h4>

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

        {!trackingPullRequestsFailed.includes(pullRequestNumber) &&
          !pullRequestBranchStatus &&
          pullRequestInformation?.state != "open" && (
            <Skeleton className="h-6 w-full" />
          )}

        {trackingPullRequestsFailed.includes(pullRequestNumber) && (
          <Badge variant="destructive">Failed to fetch PR data</Badge>
        )}

        {pullRequestInformation?.state == "open" && (
          <Badge variant="secondary">Not merged</Badge>
        )}

        {pullRequestInformation?.state == "closed" && (
          <>
            <ul
              className="no-scrollbar flex space-x-1 overflow-x-auto whitespace-nowrap"
              style={{ scrollbarWidth: "none" }}
              ref={ref}
            >
              {pullRequestBranchStatus &&
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
                })()}
            </ul>
          </>
        )}

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

      {/* Track & Untrack */}
      <div className="bg-background absolute top-1/2 right-2 -translate-y-1/2 rounded-md opacity-0 transition duration-75 group-focus-within:opacity-100 group-hover:opacity-100">
        <TrackPullRequestButton
          tracked={tracked}
          iconOnly={true}
          pullRequestNumber={pullRequestNumber}
          setTrackingPullRequests={setTrackingPullRequests}
        />
      </div>
    </div>
  );
}
