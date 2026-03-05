export type VoteSubmitDomainResult =
  | {
      kind: "matchup_unavailable";
    }
  | {
      kind: "vote_recorded";
      eventId: string;
      acceptedForScoring: boolean;
      validationStatus: string;
    };
