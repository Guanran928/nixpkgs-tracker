import type { PullRequestMetadata } from "@/components/PullRequestStatus";

import PullRequestStatusCompact from "@/components/PullRequestStatusCompact";
import { useGitHubFetch } from "@/hooks/use-github-fetch";

import { AnimatePresence, motion } from "motion/react";
import { GitPullRequestArrow } from "lucide-react";
import { useEffect, useState } from "react";
import { useMediaQuery } from "usehooks-ts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const MotionCard = motion.create(Card);
const fetchingPRs = new Set<number>();

export default function PullRequestSidebar({
  trackingPullRequests,
  setTrackingPullRequests,
}: {
  trackingPullRequests: PullRequestMetadata[];
  setTrackingPullRequests: React.Dispatch<
    React.SetStateAction<PullRequestMetadata[]>
  >;
}) {
  const { fetchPullRequestData, fetchBranchData } = useGitHubFetch();

  const isLarge = useMediaQuery("(min-width: 768px)"); // tailwind's `md:`

  const [trackingPullRequestsFailed, setTrackingPullRequestsFailed] = useState<
    number[]
  >([]);

  useEffect(() => {
    localStorage.setItem(
      "tracking_pull_requests",
      JSON.stringify(
        trackingPullRequests.map(({ pullRequestNumber }) => ({
          pullRequestNumber,
        })),
      ),
    );
  }, [trackingPullRequests]);

  useEffect(() => {
    const prsWithoutData = trackingPullRequests
      .filter((pr) => !pr.pullRequestInformation)
      .filter(
        (pr) => !trackingPullRequestsFailed.includes(pr.pullRequestNumber),
      )
      .filter((pr) => !fetchingPRs.has(pr.pullRequestNumber));

    if (prsWithoutData.length === 0) return;

    prsWithoutData.forEach((pr) => fetchingPRs.add(pr.pullRequestNumber));

    Promise.all(
      prsWithoutData.map(async (pr) => {
        const data = await fetchPullRequestData(pr.pullRequestNumber);
        if (!data) {
          fetchingPRs.delete(pr.pullRequestNumber);
          setTrackingPullRequestsFailed((prev) => [
            ...prev,
            pr.pullRequestNumber,
          ]);
          return null;
        }

        setTrackingPullRequests((current) => {
          const updated = [...current];
          const i = updated.findIndex(
            (p) => p.pullRequestNumber === pr.pullRequestNumber,
          );
          if (i !== -1)
            updated[i] = { ...updated[i], pullRequestInformation: data };
          return updated;
        });

        const branchStatus = await fetchBranchData(data);
        fetchingPRs.delete(pr.pullRequestNumber);

        return { pr, branchStatus };
      }),
    ).then((results) => {
      setTrackingPullRequests((current) => {
        const updated = [...current];
        results.forEach((result) => {
          if (!result) return;
          const i = updated.findIndex(
            (p) => p.pullRequestNumber === result.pr.pullRequestNumber,
          );
          if (i !== -1)
            updated[i] = {
              ...updated[i],
              pullRequestBranchStatus: result.branchStatus,
            };
        });
        return updated;
      });
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    trackingPullRequests,
    fetchPullRequestData,
    fetchBranchData,
    trackingPullRequestsFailed,
  ]);

  return (
    <AnimatePresence>
      {trackingPullRequests.length > 0 && (
        <MotionCard
          className="max-w-sm overflow-x-hidden overflow-y-auto *:w-96"
          initial={
            isLarge ? { width: 0, opacity: 0 } : { height: 0, opacity: 0 }
          }
          animate={
            isLarge
              ? { width: "auto", opacity: 1 }
              : { height: "auto", opacity: 1 }
          }
          exit={isLarge ? { width: 0, opacity: 0 } : { height: 0, opacity: 0 }}
        >
          <div className="space-y-3">
            <CardHeader className="font-medium">
              <CardTitle className="flex items-center gap-2">
                <GitPullRequestArrow />
                <h4>Pull requests</h4>
              </CardTitle>
            </CardHeader>
            <Separator />
          </div>
          {trackingPullRequests.map((pr) => {
            return (
              <CardContent key={pr.pullRequestNumber}>
                <PullRequestStatusCompact
                  pullRequestNumber={pr.pullRequestNumber}
                  pullRequestInformation={pr.pullRequestInformation}
                  pullRequestBranchStatus={pr.pullRequestBranchStatus}
                  setTrackingPullRequests={setTrackingPullRequests}
                  trackingPullRequestsFailed={trackingPullRequestsFailed}
                  tracked={true}
                />
              </CardContent>
            );
          })}
        </MotionCard>
      )}
    </AnimatePresence>
  );
}
