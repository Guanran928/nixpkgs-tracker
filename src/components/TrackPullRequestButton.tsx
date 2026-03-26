import type { PullRequestMetadata } from "./PullRequestStatus";
import { BellRing, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function TrackPullRequestButton({
  tracked,
  iconOnly,
  pullRequestNumber,
  setTrackingPullRequests,
}: {
  tracked: boolean;
  iconOnly: boolean;
  pullRequestNumber: number;
  setTrackingPullRequests: React.Dispatch<
    React.SetStateAction<PullRequestMetadata[]>
  >;
}) {
  return (
    <Button
      variant="outline"
      size={iconOnly ? "sm" : "xs"}
      onClick={() => {
        if (tracked) {
          setTrackingPullRequests((currentTracking) =>
            currentTracking.filter(
              (pr) => pr.pullRequestNumber !== pullRequestNumber,
            ),
          );
          toast.success(`Stopped tracking PR #${pullRequestNumber}`);
        } else {
          setTrackingPullRequests((currentTracking) => {
            const alreadyExists = currentTracking.find(
              (obj) => obj.pullRequestNumber === pullRequestNumber,
            );

            if (alreadyExists) {
              toast("Pull request is already being tracked!");
              return currentTracking;
            } else {
              const newItem = {
                pullRequestNumber: pullRequestNumber,
              } as PullRequestMetadata;
              return [...currentTracking, newItem];
            }
          });
        }
      }}
    >
      {tracked ? (
        <>
          <BellOff />
          {!iconOnly && <span>Untrack</span>}
        </>
      ) : (
        <>
          <BellRing />
          {!iconOnly && <span>Track</span>}
        </>
      )}
    </Button>
  );
}
