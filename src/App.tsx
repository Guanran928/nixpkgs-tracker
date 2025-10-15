import { useState, type FormEvent } from "react";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster, toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";

interface PullRequestInfomation {
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

interface Branch {
  ref: "staging-next" | "master" | string;
}

interface User {
  html_url: URL;
  id: number;
  login: string;
  type: "User";
}

interface PullRequestBranchStatus {
  branch: string;
  status: "merged" | "not-merged" | "fetch-error";
}

function App() {
  const [pullRequestNumber, setPullRequestNumber] = useState("");
  const [pullRequestInfomation, setPullRequestInfomation] =
    useState<null | PullRequestInfomation>(null);
  const [pullRequestBranchStatus, setPullRequestBranchStatus] = useState<
    null | PullRequestBranchStatus[]
  >(null);

  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingBranch, setIsFetchingBranch] = useState(false);

  const [token, setToken] = useState(() => {
    return localStorage.getItem("token") || "";
  });

  const fetchPullRequestStatus = async (event: FormEvent) => {
    event.preventDefault();

    const match = pullRequestNumber.match(/\/pull\/(\d+)/);
    const pr = match ? match[1] : pullRequestNumber;

    const newUrl = `${window.location.pathname}?pr=${pr}`;
    window.history.pushState({}, "", newUrl);

    setPullRequestNumber(pr);
    setIsFetching(true);
    setPullRequestInfomation(null);
    setPullRequestBranchStatus(null);

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
      toast.error(`Error while fetching pull request data: Not found`);
      setIsFetching(false);
      return;
    } else if (response.status === 403) {
      toast.error("Error while fetching pull request data: Rate limit reached");
      setIsFetching(false);
      return;
    } else if (!response.ok) {
      toast.error("Error while fetching pull request data: Unknown Error");
      setIsFetching(false);
      return;
    }

    const data = await response.json();

    setPullRequestInfomation(data);
    setIsFetching(false);
    setIsFetchingBranch(true);

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
        branches = ["nixos-25.05", "nixos-25.05-small", "nixpkgs-25.05-darwin"];
        break;
    }

    const status = await Promise.all(
      branches.map(async (branch) => {
        const headers: HeadersInit = {
          Accept: "application/vnd.github+json",
        };

        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(
          `https://api.github.com/repos/NixOS/nixpkgs/compare/${branch}...${data.merge_commit_sha}`,
          { headers },
        );

        if (response.status === 404) {
          toast.error(`Error while fetching branch data: Not found`);
          return { branch, status: "fetch-error" } as PullRequestBranchStatus;
        } else if (response.status === 403) {
          toast.error("Error while fetching branch data: Rate limit reached");
          return { branch, status: "fetch-error" } as PullRequestBranchStatus;
        } else if (!response.ok) {
          toast.error("Error while fetching branch data: Unknown Error");
          return { branch, status: "fetch-error" } as PullRequestBranchStatus;
        }

        const prdata = await response.json();
        if (prdata.status === "identical" || prdata.status === "behind") {
          return { branch, status: "merged" } as PullRequestBranchStatus;
        }
        return { branch, status: "not-merged" } as PullRequestBranchStatus;
      }),
    );

    setIsFetchingBranch(false);
    setPullRequestBranchStatus(status);
  };

  return (
    <>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <div className="flex h-screen flex-col items-center justify-center space-y-2">
          {/* TODO: I want to animate the height change! */}
          <Card className="w-full max-w-sm">
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
                onSubmit={fetchPullRequestStatus}
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

            {pullRequestInfomation && (
              <>
                <Separator />
                <CardContent className="text-left">
                  <Badge>
                    {(() => {
                      const state = pullRequestInfomation.state;
                      const merged = pullRequestInfomation.merged;

                      if (state === "open") return "Open";
                      if (merged) return "Merged";
                      return "Closed";
                    })()}
                  </Badge>
                  <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
                    <a
                      href={pullRequestInfomation.html_url}
                      className="decoration-opacity-0 hover:decoration-opacity-100 break-all underline decoration-transparent transition-colors duration-200 ease-in-out hover:decoration-current"
                    >
                      {pullRequestInfomation.title}
                    </a>{" "}
                    <span className="text-muted-foreground">
                      #{pullRequestInfomation.number}
                    </span>
                  </h4>
                  <div className="text-muted-foreground text-sm">
                    By {pullRequestInfomation.user.login}, was{" "}
                    {(() => {
                      const state = pullRequestInfomation.state;
                      const merged = pullRequestInfomation.merged;
                      const formatDate = (date: string) =>
                        new Date(date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        });

                      if (state === "open") {
                        return `opened on ${formatDate(pullRequestInfomation.created_at)}`;
                      }
                      if (merged) {
                        return `merged on ${formatDate(pullRequestInfomation.merged_at)}`;
                      }
                      return `closed on ${formatDate(pullRequestInfomation.closed_at)}`;
                    })()}
                  </div>

                  {pullRequestInfomation.state == "closed" && (
                    <>
                      <Separator className="my-2" />
                      <ul className="space-y-1">
                        {pullRequestBranchStatus && !isFetchingBranch ? (
                          pullRequestBranchStatus.map((branch) => {
                            return (
                              <li className="flex justify-between">
                                <div className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
                                  {branch.branch}
                                </div>
                                <Badge
                                  variant={
                                    branch.status === "merged"
                                      ? "default"
                                      : "secondary"
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
                </CardContent>
              </>
            )}
          </Card>
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
        <Toaster position="bottom-center" />
      </ThemeProvider>
    </>
  );
}

export default App;
