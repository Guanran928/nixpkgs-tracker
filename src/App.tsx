import type {
  PullRequestBranchStatus,
  PullRequestMetadata,
} from "./components/PullRequestStatus";
import type { components } from "@octokit/openapi-types";

import { GitPullRequestArrow } from "lucide-react";
import PullRequestStatus from "@/components/PullRequestStatus";
import PullRequestStatusCompact from "@/components/PullRequestStatusCompact";
import { SettingsDialog } from "@/components/SettingsDialog";
import { toast } from "sonner";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type PullRequestInformation = components["schemas"]["pull-request"];
type GitHubErrorResponse = components["schemas"]["basic-error"];

type RateLimitState = {
  remaining: number | null;
  resetTimestamp: number | null;
};

type PullRequestLookupState = {
  isFetching: boolean;
  information: PullRequestInformation | null;
  branchStatus: PullRequestBranchStatus[] | null;
};

const DEFAULT_TITLE = document.title;

function App() {
  useEffect(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const pullRequest = urlParams.get("pr");

    if (pullRequest) {
      fetchPullRequestStatus();
    }
  }, []);

  const [token, setToken] = useState(() => {
    return localStorage.getItem("token") || "";
  });

  const [rateLimit, setRateLimit] = useState<RateLimitState>({
    remaining: null,
    resetTimestamp: null,
  });

  const [trackingPullRequests, setTrackingPullRequests] = useState<
    PullRequestMetadata[]
  >(() => JSON.parse(localStorage.getItem("tracking_pull_requests") || "[]"));

  const [trackingPullRequestsFailed, setTrackingPullRequestsFailed] = useState<
    number[]
  >([]);

  const [pullRequestLookup, setPullRequestLookup] =
    useState<PullRequestLookupState>({
      isFetching: false,
      information: null,
      branchStatus: null,
    });

  useEffect(() => {
    if (
      pullRequestLookup?.information?.number &&
      pullRequestLookup?.information?.title
    ) {
      document.title = `#${pullRequestLookup.information.number}: ${pullRequestLookup.information.title}`;
    } else {
      document.title = DEFAULT_TITLE;
    }
  }, [pullRequestLookup]);

  useEffect(() => {
    setRateLimit({ remaining: null, resetTimestamp: null });
  }, [token]);

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

  const parseRateLimitHeaders = (headers: Headers) => {
    const rateLimitRemaining = headers.get("x-ratelimit-remaining");
    const rateLimitReset = headers.get("x-ratelimit-reset");

    if (rateLimitRemaining && rateLimitReset) {
      const remaining = parseInt(rateLimitRemaining, 10);
      const resetTimestamp = parseInt(rateLimitReset, 10);

      if (!isNaN(remaining) && !isNaN(resetTimestamp)) {
        setRateLimit((prev) => ({
          remaining:
            prev.remaining === null || remaining < prev.remaining
              ? remaining
              : prev.remaining,

          resetTimestamp:
            prev.resetTimestamp === null || resetTimestamp > prev.resetTimestamp
              ? resetTimestamp
              : prev.resetTimestamp,
        }));
      }
    }
  };

  const fetchPullRequestData = useCallback(
    async (pr: string) => {
      const headers: HeadersInit = {
        Accept: "application/vnd.github+json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `https://api.github.com/repos/nixos/nixpkgs/pulls/${pr}`,
        { headers },
      );

      if (!response.ok) {
        const data = (await response.json()) as GitHubErrorResponse;
        toast.error(`Error while fetching PR #${pr}`, {
          description: data.message,
        });

        return null;
      }

      parseRateLimitHeaders(response.headers);

      const data = (await response.json()) as PullRequestInformation;

      let branches;
      const releaseMatch = data.base.ref.match(/^release-(\d+\.\d+)$/);
      const releaseStagingMatch = data.base.ref.match(/^staging-(\d+\.\d+)$/);

      if (releaseMatch) {
        const ver = releaseMatch[1];
        branches = [
          `nixos-${ver}`,
          `nixos-${ver}-small`,
          `nixpkgs-${ver}-darwin`,
        ];
      } else if (releaseStagingMatch) {
        const ver = releaseStagingMatch[1];
        branches = [
          `staging-next-${ver}`,
          `release-${ver}`,
          `nixos-${ver}`,
          `nixos-${ver}-small`,
          `nixpkgs-${ver}-darwin`,
        ];
      } else {
        switch (data.base.ref) {
          case "master":
            branches = [
              "nixpkgs-unstable",
              "nixos-unstable",
              "nixos-unstable-small",
            ];
            break;
          case "staging-next":
            branches = [
              "master",
              "nixpkgs-unstable",
              "nixos-unstable",
              "nixos-unstable-small",
            ];
            break;
          case "staging":
            branches = [
              "staging-next",
              "master",
              "nixpkgs-unstable",
              "nixos-unstable",
              "nixos-unstable-small",
            ];
            break;
          case "python-updates":
            branches = [
              "staging",
              "staging-next",
              "master",
              "nixpkgs-unstable",
              "nixos-unstable",
              "nixos-unstable-small",
            ];
            break;
          default:
            toast.error("Unknown target branch");
            return null;
        }
      }

      const status = await Promise.all(
        branches.map(async (branch) => {
          const response = await fetch(
            `https://api.github.com/repos/NixOS/nixpkgs/compare/${branch}...${data.merge_commit_sha}`,
            { headers },
          );

          if (!response.ok) {
            const prdata = (await response.json()) as GitHubErrorResponse;

            return {
              branch,
              status: "fetch-error",
              message: prdata.message,
            } as PullRequestBranchStatus;
          }

          parseRateLimitHeaders(response.headers);

          const prdata = await response.json();
          if (prdata.status === "identical" || prdata.status === "behind") {
            return { branch, status: "merged" } as PullRequestBranchStatus;
          }
          return { branch, status: "not-merged" } as PullRequestBranchStatus;
        }),
      );

      const failed = status.filter((s) => s.status === "fetch-error");
      if (failed.length > 0) {
        const uniqueMessages = [
          ...new Set(failed.map((s) => s.message).filter(Boolean)),
        ];
        toast.error(
          `Failed to fetch ${failed.length}/${branches.length} branches for PR #${pr}`,
          { description: uniqueMessages.join(", ") },
        );
      }

      return {
        pullRequestInformation: data,
        pullRequestBranchStatus: status,
      };
    },
    [token],
  );

  useEffect(() => {
    const prsWithoutData = trackingPullRequests
      .filter((pr) => !pr.pullRequestInformation)
      .filter(
        (pr) => !trackingPullRequestsFailed.includes(pr.pullRequestNumber),
      );

    if (prsWithoutData.length > 0) {
      const fetchAndUpdate = async () => {
        const newPrData = await Promise.all(
          prsWithoutData.map(async (pr) => {
            const data = await fetchPullRequestData(
              pr.pullRequestNumber.toString(),
            );
            if (!data) {
              setTrackingPullRequestsFailed((prev) => [
                ...prev,
                pr.pullRequestNumber,
              ]);
            }
            return data;
          }),
        );

        setTrackingPullRequests((currentPRs) => {
          const updatedPRs = [...currentPRs];
          newPrData.forEach((data, index) => {
            if (data) {
              const prToUpdateIndex = updatedPRs.findIndex(
                (p) =>
                  p.pullRequestNumber ===
                  prsWithoutData[index].pullRequestNumber,
              );
              if (prToUpdateIndex !== -1) {
                updatedPRs[prToUpdateIndex] = {
                  ...updatedPRs[prToUpdateIndex],
                  ...data,
                };
              }
            }
          });
          return updatedPRs;
        });
      };
      fetchAndUpdate();
    }
  }, [trackingPullRequests, fetchPullRequestData]);

  const [pullRequestNumber, setPullRequestNumber] = useState(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    return urlParams.get("pr") || "";
  });

  const fetchPullRequestStatus = async () => {
    const match = pullRequestNumber.match(/\/pull\/(\d+)/);
    const pr = match ? match[1] : pullRequestNumber;

    const newUrl = `${window.location.pathname}?pr=${pr}`;
    window.history.pushState({}, "", newUrl);

    setPullRequestNumber(pr);

    setPullRequestLookup({
      isFetching: true,
      information: null,
      branchStatus: null,
    });

    const data = await fetchPullRequestData(pr);
    setPullRequestLookup({
      isFetching: false,
      information: data?.pullRequestInformation ?? null,
      branchStatus: data?.pullRequestBranchStatus ?? null,
    });
  };

  return (
    <>
      <div className="flex h-screen flex-col items-center justify-between p-4 md:p-8">
        <div className="flex flex-col items-center space-y-3 md:space-y-4">
          {!token &&
            rateLimit.remaining &&
            rateLimit.resetTimestamp &&
            rateLimit.remaining < 100 && (
              <div className="flex flex-wrap justify-center gap-1">
                <Badge>{rateLimit.remaining} requests remaining</Badge>
                <Badge>
                  Resets at{" "}
                  {new Date(
                    rateLimit.resetTimestamp * 1000,
                  ).toLocaleTimeString()}
                </Badge>
              </div>
            )}
          {/* TODO: I want to animate the height change! */}
          <main className="items-start space-y-2 md:flex md:flex-row md:gap-2">
            <Card className="w-96 max-w-sm">
              <CardHeader>
                <CardTitle>
                  <span className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
                    nixpkgs
                  </span>{" "}
                  Pull Request Tracker
                </CardTitle>

                <CardDescription>
                  Enter a PR number or its URL to track its status.
                </CardDescription>

                <CardAction>
                  <SettingsDialog token={token} setToken={setToken} />
                </CardAction>

                <form
                  className="col-span-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    fetchPullRequestStatus();
                  }}
                >
                  <Input
                    required
                    type="text"
                    id="pull"
                    placeholder="e.g. 449457"
                    value={pullRequestNumber}
                    className="w-full"
                    onChange={(e) => setPullRequestNumber(e.target.value)}
                  />
                  <Button disabled={pullRequestLookup.isFetching} type="submit">
                    {pullRequestLookup.isFetching && <Spinner />}
                    Check Status
                  </Button>
                </form>
              </CardHeader>

              {pullRequestLookup.information && (
                <>
                  <Separator />
                  <CardContent>
                    <PullRequestStatus
                      pullRequestInformation={pullRequestLookup.information}
                      pullRequestBranchStatus={pullRequestLookup.branchStatus}
                      setTrackingPullRequests={setTrackingPullRequests}
                      tracked={false}
                      interative={true}
                    />
                  </CardContent>
                </>
              )}
            </Card>

            {trackingPullRequests.length > 0 && (
              <Card className="w-96 max-w-sm overflow-y-auto">
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
                  // FIXME: untrack button is not shown in skeleton mode
                  if (
                    !pr.pullRequestInformation ||
                    !pr.pullRequestBranchStatus
                  ) {
                    return (
                      <div
                        key={pr.pullRequestNumber}
                        className="mx-6 space-y-1"
                      >
                        <div className="flex justify-between gap-2">
                          <Skeleton className="h-6 w-[100px]" />
                          <span className="text-muted-foreground font-semibold">
                            #{pr.pullRequestNumber}
                          </span>
                        </div>
                        {trackingPullRequestsFailed.includes(
                          pr.pullRequestNumber,
                        ) ? (
                          <Badge variant="destructive">
                            Failed to fetch PR data
                          </Badge>
                        ) : (
                          <Skeleton className="h-6 w-full" />
                        )}
                      </div>
                    );
                  }

                  return (
                    <CardContent key={pr.pullRequestNumber}>
                      <PullRequestStatusCompact
                        pullRequestInformation={pr.pullRequestInformation}
                        pullRequestBranchStatus={pr.pullRequestBranchStatus}
                        setTrackingPullRequests={setTrackingPullRequests}
                        tracked={true}
                      />
                    </CardContent>
                  );
                })}
              </Card>
            )}
          </main>
        </div>
        <footer className="bg-background/50 text-muted-foreground px-4 py-2 text-center text-xs">
          <div>Made with &lt;3 by Guanran Wang</div>
          <div>
            <a
              className="underline"
              href="https://github.com/Guanran928/nixpkgs-tracker"
            >
              Source code
            </a>{" "}
            available on GitHub
          </div>
          <div>
            Inspired by{" "}
            <a className="underline" href="https://nixpkgs-tracker.ocfox.me/">
              nixpkgs-tracker.ocfox.me
            </a>{" "}
            and{" "}
            <a className="underline" href="https://nixpk.gs/pr-tracker.html">
              nixpk.gs
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}

export default App;
