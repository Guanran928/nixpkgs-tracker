import type { components } from "@octokit/openapi-types";
type PullRequestInformation = components["schemas"]["pull-request"];

import PullRequestScreenShotPopover from "@/components/PullRequestScreenShotPopover";
import TrackPullRequestButton from "@/components/TrackPullRequestButton";

import { Check, CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export interface PullRequestBranchStatus {
  branch: string;
  status: "merged" | "not-merged" | "fetch-error";
  message?: string;
}

export interface PullRequestMetadata {
  pullRequestNumber: number;
  pullRequestInformation: PullRequestInformation | null;
  pullRequestBranchStatus: PullRequestBranchStatus[] | null;
}

export default function PullRequestStatus({
  pullRequestNumber,
  pullRequestInformation,
  pullRequestBranchStatus,
  setTrackingPullRequests,
  tracked,
  interactive,
}: {
  pullRequestNumber: number;
  pullRequestInformation: PullRequestInformation | null;
  pullRequestBranchStatus: PullRequestBranchStatus[] | null;
  setTrackingPullRequests: React.Dispatch<
    React.SetStateAction<PullRequestMetadata[]>
  >;
  tracked: boolean;
  interactive: boolean;
}) {
  return (
    <>
      {pullRequestInformation && (
        <>
          <div className="flex items-center justify-between">
            <div className="space-x-1">
              <Badge>
                {(() => {
                  const state = pullRequestInformation.state;
                  const merged = pullRequestInformation.merged;

                  if (state === "open") return "Open";
                  if (merged) return "Merged";
                  return "Closed";
                })()}
              </Badge>
              <Badge variant="secondary">
                {pullRequestInformation.base.ref}
              </Badge>
            </div>
            {interactive && (
              <div className="flex space-x-1">
                <PullRequestScreenShotPopover>
                  <PullRequestStatus
                    pullRequestNumber={pullRequestNumber}
                    pullRequestInformation={pullRequestInformation}
                    pullRequestBranchStatus={pullRequestBranchStatus}
                    setTrackingPullRequests={setTrackingPullRequests}
                    tracked={false}
                    interactive={false}
                  />
                </PullRequestScreenShotPopover>
                <TrackPullRequestButton
                  tracked={tracked}
                  iconOnly={false}
                  pullRequestNumber={pullRequestNumber}
                  setTrackingPullRequests={setTrackingPullRequests}
                />
              </div>
            )}
          </div>
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
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
          <div className="text-muted-foreground text-sm">
            By {pullRequestInformation.user.login}, was{" "}
            {(() => {
              const state = pullRequestInformation.state;
              const merged = pullRequestInformation.merged;
              const formatDate = (date: string) =>
                new Date(date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });

              if (state === "open") {
                return `opened on ${formatDate(pullRequestInformation.created_at)}`;
              }
              if (merged) {
                return `merged on ${formatDate(pullRequestInformation.merged_at!)}`;
              }
              return `closed on ${formatDate(pullRequestInformation.closed_at!)}`;
            })()}
          </div>
          {pullRequestInformation.state == "closed" && (
            <>
              <Separator className="my-2" />
              <ul className="space-y-1">
                {pullRequestBranchStatus ? (
                  pullRequestBranchStatus.map((branch) => {
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

                    const getText = (
                      status: PullRequestBranchStatus["status"],
                    ) => {
                      switch (status) {
                        case "merged":
                          return "Merged";
                        case "not-merged":
                          return "Not merged";
                        case "fetch-error":
                          return "Fetch error";
                      }
                    };

                    return (
                      <li key={branch.branch} className="flex justify-between">
                        <div className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
                          {branch.branch}
                        </div>
                        <Badge variant={getVariant(branch.status)}>
                          {getIcon(branch.status)}
                          {getText(branch.status)}
                        </Badge>
                      </li>
                    );
                  })
                ) : (
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
            </>
          )}
        </>
      )}
    </>
  );
}
