# Marketing operations

Start the HTTP service with `MARKETING_API_KEY` configured. Missing credentials fail startup. For explicit development without a key, set `MARKETING_ALLOW_LOCAL_NO_AUTH=true`; this binds only `127.0.0.1` and is rejected when `NODE_ENV=production`. Health remains public. API calls use `Authorization: Bearer <key>`.

`MARKETING_STATE_PATH` must point to persistent storage. Server and CLI processes may share the same state file: atomic directory locks serialize read/modify/write transactions, and fsynced temporary files are atomically renamed into place. Multiple replicas with separate volumes are **not supported**; use one persistent shared state location or migrate the ledger to a transactional database before scaling. Never use whole-state `saveMarketingState` for a read/modify/write operation; use `updateMarketingState` instead.

Posting adapters share a durable operation ledger keyed by platform, format and content ID. Retrying `post-all` reuses an already completed X result. Concurrent calls cannot submit the same operation twice. Intentional new publication requires a new content ID. Dry-run posting does not write the ledger, post history or content status.

TikTok asynchronous submissions are labeled `accepted`, `scheduled` or `draft`; they do not mark content published. The ledger is available through authenticated `GET /api/list`. The existing `checkTikTokUploadStatus` helper can inspect provider status, but automated provider-status reconciliation is not implemented. An accepted job is not proof of eventual publication. Historical TikTok records without explicit publication status are treated as submissions for deduplication and are not used to infer new published content status.

If posting fails after an operation starts, it becomes `needs-reconciliation`; a crashed process may leave `in-progress`. Both block automatic retries because a provider could have accepted the request before its response was lost. X main/reply IDs are checkpointed immediately after each returned result. Partial threads and uncertain submissions require operator reconciliation, rather than an automatic retry that could duplicate a post.

To reconcile, stop all marketing writers, back up the state file, and compare the operation's remote IDs and content with the platform/provider records. Only after establishing the actual remote outcome should an operator repair the ledger and matching post/content state. Do not delete an operation to retry merely because it timed out. There is deliberately no HTTP endpoint to clear these protections.

A process crash while holding the short-lived state transaction lock can leave `<state path>.lock`. Inspect its `owner` file and verify all owning/writing processes are stopped before removing that directory. Locks are never stolen based on age or automatically deleted by competing waiters.

Run `pnpm --filter @chartsuno/marketing test` for isolated HTTP, multi-process state, publication retry, partial-thread, credential rotation, dry-run and asynchronous-submission regressions. Tests use temporary files and fake remote adapters; they do not publish content.
