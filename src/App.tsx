import type {
  PullRequestBranchStatus,
  PullRequestMetadata,
} from "@/components/PullRequestStatus";
import type { components } from "@octokit/openapi-types";

import PullRequestSidebar from "@/components/PullRequestSidebar";
import PullRequestStatus from "@/components/PullRequestStatus";
import RateLimitBar from "@/components/RateLimitBar";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useGitHubFetch } from "@/hooks/use-github-fetch";

import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

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

type PullRequestInformation = components["schemas"]["pull-request"];

type PullRequestLookupState = {
  isFetching: boolean;
  information: PullRequestInformation | null;
  branchStatus: PullRequestBranchStatus[] | null;
};

const DEFAULT_TITLE = document.title;

function App() {
  const { rateLimit, setRateLimit, fetchPullRequestData, fetchBranchData } =
    useGitHubFetch();

  const [trackingPullRequests, setTrackingPullRequests] = useState<
    PullRequestMetadata[]
  >(() => JSON.parse(localStorage.getItem("tracking_pull_requests") || "[]"));

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

  const [pullRequestNumberInput, setPullRequestNumberInput] = useState("");

  useEffect(() => {
    const pullRequestString = new URLSearchParams(window.location.search).get(
      "pr",
    );
    if (!pullRequestString) return;
    const pullRequestNumber = parseInt(pullRequestString, 10);

    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    setPullRequestNumberInput(pullRequestString);
    submitPullRequest(pullRequestNumber, controllerRef.current.signal);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // submit handler
  const controllerRef = useRef<AbortController | null>(null);
  const submitPullRequest = async (
    pullRequestNumber: number,
    signal?: AbortSignal,
  ) => {
    if (!pullRequestNumber || pullRequestNumber < 100) {
      toast.error("Invalid PR number");
      return;
    }

    window.history.pushState(
      {},
      "",
      `${window.location.pathname}?pr=${pullRequestNumber}`,
    );
    setPullRequestNumberInput(pullRequestNumber.toString());
    setPullRequestLookup({
      isFetching: true,
      information: null,
      branchStatus: null,
    });

    const information = await fetchPullRequestData(pullRequestNumber, signal);
    if (!information || signal?.aborted) {
      setPullRequestLookup({
        isFetching: false,
        information: null,
        branchStatus: null,
      });
      return;
    }

    setPullRequestLookup({
      isFetching: false,
      information,
      branchStatus: null,
    });

    const branchStatus = await fetchBranchData(information, signal);
    if (signal?.aborted) return;

    setPullRequestLookup({
      isFetching: false,
      information,
      branchStatus,
    });
  };

  return (
    <>
      <div className="flex h-screen flex-col items-center justify-between p-4 md:p-8">
        <motion.div
          className="flex flex-col items-center space-y-3 md:space-y-4"
          initial={{ y: "20px", opacity: 0 }}
          animate={{ y: "0px", opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <RateLimitBar rateLimit={rateLimit} setRateLimit={setRateLimit} />
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
                  <SettingsDialog />
                </CardAction>

                <form
                  className="col-span-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();

                    const match = pullRequestNumberInput.match(/\/pull\/(\d+)/);
                    const pullRequestString = match
                      ? match[1]
                      : pullRequestNumberInput.trim();
                    const pullRequestNumber = parseInt(pullRequestString, 10);

                    controllerRef.current?.abort();
                    controllerRef.current = new AbortController();
                    submitPullRequest(
                      pullRequestNumber,
                      controllerRef.current.signal,
                    );
                  }}
                >
                  <Input
                    required
                    type="text"
                    id="pull"
                    placeholder="e.g. 449457"
                    value={pullRequestNumberInput}
                    className="w-full"
                    onChange={(e) => setPullRequestNumberInput(e.target.value)}
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
                          pullRequestNumber={
                            pullRequestLookup.information.number
                          }
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

            <PullRequestSidebar
              trackingPullRequests={trackingPullRequests}
              setTrackingPullRequests={setTrackingPullRequests}
            />
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
