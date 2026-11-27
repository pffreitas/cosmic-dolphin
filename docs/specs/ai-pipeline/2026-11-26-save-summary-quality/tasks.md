# Save Summary Quality tasks

| | |
|---|---|
| Spec | [Approved spec](../2026-11-26-save-summary-quality.md) · sha256:9b45b2cdfda518c1be5cdb5c853b06790ed4b77c44cd3a1251f04a24b0136725 |
| Approval | Paulo approved the reviewed revision `50171a0`. The approved artifact changes its status only. |
| Execution grant | “Break it down and full send” requests implementation and delivery through the agreed release gates. |
| Plan status | Approved by Paulo, 2026-11-27 ("Approved") |
| Delivery | One backend PR from an isolated feature branch to `main`, squash merge, API and worker auto-deploy |
| Planning base | Local `main` at `4c8d362f18b8e495a6ffe33d103f77c32554dda6`. Live `origin/main` observed at `671e2781e2f685804bf33bb06422bd1b92b05154`. Use the actual fetched PR base. |
| Worktree | Original checkout contains concurrent mobile, design and workflow changes. Start from fetched main in an isolated worktree and copy only the approved spec, approval page and task record. |

**Current outcome.** Approved spec and manual breakdown. No feature edits, execution branch or PR yet.

**Next gate.** Plan approved 2026-11-27; execution started. The formal `spec-breakdown` and `full-send` skills were unavailable in this session. This plan follows the approved spec, release runbook and repository task precedent. Full-send execution is pending the applicable workflow and plan approval.

## Implementation

| ID | Depends on | Work and acceptance | Status |
|---|---|---|---|
| T-1 | Fresh PR base | Commit the manual eval harness first. Drive the real processor on an isolated disposable database with fresh rows and the production scrape cache seam. Record the pre-change baseline, source references, usage and model ID. Register the manifest before scoring. Retain output outside Git. FR-9, NFR-9, §8.5. | Todo |
| T-2 | T-1 | Restore FxTwitter thread extraction, expanded facets, quote, photos, thumbnail and provenance. Read one eligible link in the guarded direct reader within 60 seconds. Verify fallbacks, abort, preview, redirect rejection before dispatch, log fields and persisted content. FR-1, FR-4, FR-8, FR-10, NFR-1, NFR-5, NFR-7. | Todo |
| T-3 | T-2 | Preserve article blocks and embedding bounds. Implement prompt v2 and both schemas. Persist a teaser downgrade before the fallback call, clear stale source derivatives and verify redelivery and scoped Retry/Regenerate. Add atomic title provenance for public fetch and X summary writes. Verify prior, concurrent and same-value owner edits plus legacy rows. FR-2, FR-3, FR-5–FR-8, FR-11, NFR-2, NFR-6. | Todo |
| T-4 | T-3 | Update extraction, functional and backend plan docs. Run the seeded linked and standalone paywall proofs, source and title integration proofs, and production-code eval for Luna, Haiku and Sonnet in separate processes. Use the approved options, common source, 12 fixtures and three runs per configuration. Prepare five blinded records for Paulo before scores are viewed. FR-9, FR-13, G-1–G-5, NFR-9. | Todo |
| T-5 | T-4 | Set `anthropic/claude-haiku-5.5` as the large default with its evaluated provider options. Make a teaser lede unusable and verify it with real Haiku on both paywall fixtures, the example and two readable articles, three unjudged runs each. Rerun the example and a digest smoke. No candidate judging or calibration. FR-12, D-19, D-20. | Todo |
| T-6 | T-5 | Prove fresh-checkout contract inputs, API/worker/shared builds, serial backend suites and Linux API/worker images using the runbook. Complete bounded Sol review and update the branch if necessary. File and link one complete PR, verify its live head and PR Accessibility gate, and squash when the approved §8.9 merge conditions are met. Verify the exact merged backend deploy and primary production save. | Todo |

Critical path runs T-1 through T-6. The Haiku checks are pre-merge. The owner reads production results on days 1, 3 and 7 under §8.8 and §11. Apply the spec’s rollback triggers.

**Amendment, 2026-11-27.** Paulo chose Haiku without judging the matrix or calibrating (D-19), made teaser ledes unusable (D-20) and kept the public create route (D-21). Calibration and model selection move to future in-product evaluation.

## Verification and delivery

- The disposable database suites run serially. Isolate Supabase RPC as well as SQL. Record the actual command, outcome and candidate SHA. Follow the [backend release runbook](../../../runbooks/backend-and-testflight-release.md).
- Review the full package with Sol against all acceptance criteria, failure contracts, test evidence and delivery policy. Track one ledger of up to five rounds across product and release fixes. Reserve rounds for deployment or PR fixes. Each entry records base and reviewed SHAs, severity, affected criterion and disposition. Approval must cover the final behavior.
- The PR includes the judged baseline, the Haiku verification runs, measured costs, observed cuts and errors, checks and release risks. No candidate scores or calibration exist (D-19). Keep quality exceptions separate from required functional, safety and release proofs. Follow T3’s PR linking and waiting rules.
- Report merge, exact-SHA backend deployment and production proof independently. No manual TestFlight or client release belongs to this package.

| Review round | Base SHA | Reviewed SHA | Verdict and findings |
|---|---|---|---|
| 0 of 5 used | Pending execution | Pending execution | Pending |
