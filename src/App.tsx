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
import { AnimatePresence, motion } from "motion/react";

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
const MotionCard = motion(Card);
const fetchingPRs = new Set<number>();

function App() {
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
    async (pr: string, signal?: AbortSignal) => {
      const headers: HeadersInit = {
        Accept: "application/vnd.github+json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `https://api.github.com/repos/nixos/nixpkgs/pulls/${pr}`,
        { headers, signal },
      );

      if (!response.ok) {
        const data = (await response.json()) as GitHubErrorResponse;
        toast.error(`Error while fetching PR #${pr}`, {
          description: data.message,
        });

        return null;
      }

      parseRateLimitHeaders(response.headers);

      return (await response.json()) as PullRequestInformation;
    },
    [token],
  );

  const fetchBranchData = useCallback(
    async (pullRequestData: PullRequestInformation, signal?: AbortSignal) => {
      const headers: HeadersInit = {
        Accept: "application/vnd.github+json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      let branches;
      const releaseMatch =
        pullRequestData.base.ref.match(/^release-(\d+\.\d+)$/);
      const releaseStagingMatch =
        pullRequestData.base.ref.match(/^staging-(\d+\.\d+)$/);

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
        switch (pullRequestData.base.ref) {
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
            `https://api.github.com/repos/NixOS/nixpkgs/compare/${branch}...${pullRequestData.merge_commit_sha}`,
            { headers, signal },
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
          `Failed to fetch ${failed.length}/${branches.length} branches for PR #${pullRequestData.number}`,
          { description: uniqueMessages.join(", ") },
        );
      }

      return status;
    },
    [token],
  );

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
        const data = await fetchPullRequestData(
          pr.pullRequestNumber.toString(),
        );
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
  }, [trackingPullRequests, fetchPullRequestData, fetchBranchData]);

  const parsePRNumber = (input: string): string | null => {
    const match = input.match(/\/pull\/(\d+)/);
    const pr = match ? match[1] : input.trim();
    return /^\d+$/.test(pr) && parseInt(pr, 10) > 0 ? pr : null;
  };

  const [pullRequestNumber, setPullRequestNumber] = useState(""); // input value (typing)

  // initializer
  const [submittedPR, setSubmittedPR] = useState(() => {
    const raw = new URLSearchParams(window.location.search).get("pr") || "";
    return parsePRNumber(raw) ?? "";
  });

  // submit handler
  const submitPullRequest = () => {
    const pr = parsePRNumber(pullRequestNumber);
    if (!pr) {
      toast.error("Invalid PR number");
      return;
    }
    window.history.pushState({}, "", `${window.location.pathname}?pr=${pr}`);

    setPullRequestNumber(pr);
    setSubmittedPR(pr);
  };

  useEffect(() => {
    if (!submittedPR) return;
    const controller = new AbortController();

    const run = async () => {
      setPullRequestLookup({
        isFetching: true,
        information: null,
        branchStatus: null,
      });

      const prInfo = await fetchPullRequestData(submittedPR, controller.signal);
      if (controller.signal.aborted) return;

      if (!prInfo) {
        setPullRequestLookup({
          isFetching: false,
          information: null,
          branchStatus: null,
        });
        return;
      } else {
        setPullRequestLookup({
          isFetching: true,
          information: prInfo,
          branchStatus: null,
        });
      }

      const branchStatus = await fetchBranchData(prInfo, controller.signal);
      if (controller.signal.aborted) return;

      setPullRequestLookup({
        isFetching: false,
        information: prInfo,
        branchStatus,
      });
    };

    run();
    return () => controller.abort();
  }, [submittedPR]);

  return (
    <>
      <div className="flex h-screen flex-col items-center justify-between p-4 md:p-8">
        <motion.div
          className="flex flex-col items-center space-y-3 md:space-y-4"
          initial={{ y: "20px", opacity: 0 }}
          animate={{ y: "0px", opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
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
            {/* shadcn/ui's <Card> uses gap-6 by default, but I don't think framer-motion can handle gap changes when a element is removed */}
            <Card className="w-96 max-w-sm gap-0">
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
                    submitPullRequest();
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

              <AnimatePresence>
                {pullRequestLookup.information && (
                  <motion.div
                    className="overflow-hidden"
                    initial={{ height: 0, filter: "blur(4px)" }}
                    animate={{ height: "auto", filter: "blur(0px)" }}
                    exit={{ height: 0, filter: "blur(4px)" }}
                  >
                    {/* HACK: I can't put pt-6 in motion.div, because framer-motion is not getting the correct height that includes the padding... WTF? */}
                    <div className="space-y-6 pt-6">
                      <Separator />
                      <CardContent>
                        <PullRequestStatus
                          pullRequestInformation={pullRequestLookup.information}
                          pullRequestBranchStatus={
                            pullRequestLookup.branchStatus
                          }
                          setTrackingPullRequests={setTrackingPullRequests}
                          tracked={false}
                          interactive={true}
                        />
                      </CardContent>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            <AnimatePresence>
              {trackingPullRequests.length > 0 && (
                <MotionCard
                  className="max-w-sm overflow-x-hidden overflow-y-auto *:w-96"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
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
                    // FIXME: untrack button is not shown in skeleton mode
                    if (
                      !pr.pullRequestInformation ||
                      !pr.pullRequestBranchStatus
                    ) {
                      return (
                        <div
                          key={pr.pullRequestNumber}
                          className="px-6 space-y-1"
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
                </MotionCard>
              )}
            </AnimatePresence>
          </main>
        </motion.div>
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
