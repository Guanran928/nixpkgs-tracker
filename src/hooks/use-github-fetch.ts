import type { RateLimitState } from "@/components/RateLimitBar";
import type { components } from "@octokit/openapi-types";
import type { PullRequestBranchStatus } from "@/components/PullRequestStatus";
type GitHubErrorResponse = components["schemas"]["basic-error"];
type PullRequestInformation = components["schemas"]["pull-request"];

import { toast } from "sonner";
import { useCallback, useState } from "react";
import { useSettings } from "@/context/SettingsContext";

export function useGitHubFetch() {
  const { settings } = useSettings();

  const [rateLimit, setRateLimit] = useState<RateLimitState>({
    remaining: null,
    resetTimestamp: null,
  });

  const parseRateLimitHeaders = (headers: Headers) => {
    const rateLimitRemaining = headers.get("x-ratelimit-remaining");
    const rateLimitReset = headers.get("x-ratelimit-reset");

    if (rateLimitRemaining !== null && rateLimitReset !== null) {
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
    async (pullRequestNumber: number, signal?: AbortSignal) => {
      const headers: HeadersInit = {
        Accept: "application/vnd.github+json",
      };

      if (settings.token) {
        headers["Authorization"] = `Bearer ${settings.token}`;
      }

      const response = await fetch(
        `https://api.github.com/repos/nixos/nixpkgs/pulls/${pullRequestNumber}`,
        { headers, signal },
      );

      if (!response.ok) {
        const data = (await response.json()) as GitHubErrorResponse;
        toast.error(`Error while fetching PR #${pullRequestNumber}`, {
          description: data.message,
        });

        return null;
      }

      parseRateLimitHeaders(response.headers);

      return (await response.json()) as PullRequestInformation;
    },
    [settings.token],
  );

  const fetchBranchData = useCallback(
    async (pullRequestData: PullRequestInformation, signal?: AbortSignal) => {
      const headers: HeadersInit = {
        Accept: "application/vnd.github+json",
      };

      if (settings.token) {
        headers["Authorization"] = `Bearer ${settings.token}`;
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
    [settings.token],
  );

  return { rateLimit, setRateLimit, fetchPullRequestData, fetchBranchData };
}
