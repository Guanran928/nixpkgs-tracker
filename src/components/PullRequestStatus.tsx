import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export interface PullRequestInformation {
  base: Branch;
  closed_at: string;
  created_at: string;
  html_url: string;
  merge_commit_sha: string;
  merged: boolean;
  merged_at: string;
  merged_by: User;
  number: number;
  state: "open" | "closed";
  title: string;
  user: User;
}

export interface Branch {
  ref: "staging-next" | "master" | string;
}

export interface User {
  html_url: URL;
  id: number;
  login: string;
  type: "User";
}

export interface PullRequestBranchStatus {
  branch: string;
  status: "merged" | "not-merged" | "fetch-error";
}

export default function PullRequestStatus({
  pullRequestInformation,
  pullRequestBranchStatus,
}: {
  pullRequestInformation: PullRequestInformation | null;
  pullRequestBranchStatus: PullRequestBranchStatus[] | null;
}) {
  return (
    <>
      {pullRequestInformation && (
        <>
          <Badge>
            {(() => {
              const state = pullRequestInformation.state;
              const merged = pullRequestInformation.merged;

              if (state === "open") return "Open";
              if (merged) return "Merged";
              return "Closed";
            })()}
          </Badge>
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
                return `merged on ${formatDate(pullRequestInformation.merged_at)}`;
              }
              return `closed on ${formatDate(pullRequestInformation.closed_at)}`;
            })()}
          </div>

          {pullRequestInformation.state == "closed" && (
            <>
              <Separator className="my-2" />
              <ul className="space-y-1">
                {pullRequestBranchStatus ? (
                  pullRequestBranchStatus.map((branch) => {
                    return (
                      <li className="flex justify-between">
                        <div className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
                          {branch.branch}
                        </div>
                        <Badge
                          variant={
                            branch.status === "merged" ? "default" : "secondary"
                          }
                        >
                          {branch.status}
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
