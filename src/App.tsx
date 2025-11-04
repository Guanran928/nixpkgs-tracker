import type {
  PullRequestBranchStatus,
  PullRequestInformation,
  PullRequestMetadata,
} from "./components/PullRequestStatus";

import { GitPullRequestArrow } from "lucide-react";
import PullRequestStatus from "@/components/PullRequestStatus";
import { SettingsDialog } from "@/components/SettingsDialog";
import { toast } from "sonner";
import { useCallback, useEffect, useState } from "react";

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

  const [trackingPullRequests, setTrackingPullRequests] = useState<
    PullRequestMetadata[]
  >(() => JSON.parse(localStorage.getItem("tracking_pull_requests") || "[]"));

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

      if (response.status === 404) {
        toast.error(`Error while fetching PR #${pr}: Not found`);
        return null;
      } else if (response.status === 403) {
        toast.error(`Error while fetching PR #${pr}: Rate limit reached`);
        return null;
      } else if (!response.ok) {
        toast.error(`Error while fetching PR #${pr}: Unknown Error`);
        return null;
      }

      const data = (await response.json()) as PullRequestInformation;

      let branches;
      switch (data.base.ref) {
        case "master":
        case "staging-next":
          branches = [
            "nixpkgs-unstable",
            "nixos-unstable",
            "nixos-unstable-small",
          ];
          break;
        default:
          // TODO: don't hard code this
          branches = [
            "nixos-25.05",
            "nixos-25.05-small",
            "nixpkgs-25.05-darwin",
          ];
          break;
      }

      const status = await Promise.all(
        branches.map(async (branch) => {
          const response = await fetch(
            `https://api.github.com/repos/NixOS/nixpkgs/compare/${branch}...${data.merge_commit_sha}`,
            { headers },
          );

          if (response.status === 404) {
            toast.error(
              `Error while fetching branch data for PR #${pr}: Not found`,
            );
            return {
              branch,
              status: "fetch-error",
            } as PullRequestBranchStatus;
          } else if (response.status === 403) {
            toast.error(
              `Error while fetching branch data for PR #${pr}: Rate limit reached`,
            );
            return {
              branch,
              status: "fetch-error",
            } as PullRequestBranchStatus;
          } else if (!response.ok) {
            toast.error(
              `Error while fetching branch data for PR #${pr}: Unknown Error`,
            );
            return {
              branch,
              status: "fetch-error",
            } as PullRequestBranchStatus;
          }

          const prdata = await response.json();
          if (prdata.status === "identical" || prdata.status === "behind") {
            return { branch, status: "merged" } as PullRequestBranchStatus;
          }
          return { branch, status: "not-merged" } as PullRequestBranchStatus;
        }),
      );

      return {
        pullRequestInformation: data,
        pullRequestBranchStatus: status,
      };
    },
    [token],
  );

  useEffect(() => {
    const prsWithoutData = trackingPullRequests.filter(
      (pr) => !pr.pullRequestInformation,
    );
    if (prsWithoutData.length > 0) {
      const fetchAndUpdate = async () => {
        const newPrData = await Promise.all(
          prsWithoutData.map((pr) =>
            fetchPullRequestData(pr.pullRequestNumber.toString()),
          ),
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
  const [pullRequestInformation, setPullRequestInformation] =
    useState<null | PullRequestInformation>(null);
  const [pullRequestBranchStatus, setPullRequestBranchStatus] = useState<
    null | PullRequestBranchStatus[]
  >(null);

  const [isFetching, setIsFetching] = useState(false);

  const fetchPullRequestStatus = async () => {
    const match = pullRequestNumber.match(/\/pull\/(\d+)/);
    const pr = match ? match[1] : pullRequestNumber;

    const newUrl = `${window.location.pathname}?pr=${pr}`;
    window.history.pushState({}, "", newUrl);

    setPullRequestNumber(pr);
    setIsFetching(true);
    setPullRequestInformation(null);
    setPullRequestBranchStatus(null);

    const data = await fetchPullRequestData(pr);
    if (data) {
      setPullRequestInformation(data.pullRequestInformation);
      setPullRequestBranchStatus(data.pullRequestBranchStatus);
    }
    setIsFetching(false);
  };

  return (
    <>
      <div className="flex h-screen flex-col items-center justify-center space-y-2">
        {/* TODO: I want to animate the height change! */}
        <div className="h-max-1/2 flex flex-row items-start space-x-2">
          <Card className="h-full w-96 max-w-sm overflow-y-scroll">
            <CardHeader>
              <CardTitle className="text-left">
                <span className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
                  nixpkgs
                </span>{" "}
                Pull Request Tracker
              </CardTitle>

              <CardDescription className="text-left">
                Enter a PR number or its URL to track its status.
              </CardDescription>

              <CardAction>
                <SettingsDialog token={token} setToken={setToken} />
              </CardAction>

              <form
                className="col-span-2 flex w-full max-w-sm items-center gap-2"
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
                  onChange={(e) => setPullRequestNumber(e.target.value)}
                />
                <Button disabled={isFetching} type="submit">
                  {isFetching && <Spinner />}
                  Check Status
                </Button>
              </form>
            </CardHeader>

            {pullRequestInformation && (
              <>
                <Separator />
                <CardContent className="text-left">
                  <PullRequestStatus
                    pullRequestInformation={pullRequestInformation}
                    pullRequestBranchStatus={pullRequestBranchStatus}
                    setTrackingPullRequests={setTrackingPullRequests}
                    tracked={false}
                  />
                </CardContent>
              </>
            )}
          </Card>

          {trackingPullRequests.length > 0 && (
            <Card className="h-full w-96 max-w-sm overflow-y-scroll">
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
                if (!pr.pullRequestInformation || !pr.pullRequestBranchStatus) {
                  return (
                    <Skeleton
                      className="mx-4 h-48 p-2"
                      key={pr.pullRequestNumber}
                    >
                      Loading PR #{pr.pullRequestNumber}...
                    </Skeleton>
                  );
                }
                return (
                  <CardContent key={pr.pullRequestNumber}>
                    <PullRequestStatus
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
        </div>
        <footer className="text-muted-foreground text-center text-sm">
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
