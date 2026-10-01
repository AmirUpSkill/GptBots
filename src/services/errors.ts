export class SubmissionConflictError extends Error {
  readonly code = "submission_conflict";

  constructor() {
    super("This submission key has already been used for a different inquiry.");
    this.name = "SubmissionConflictError";
  }
}
