# AI-LOG.md

> Keep this file at the root of the repository and update it throughout the assignment.
>
> **Scope:** AI assistance recorded in the ChatGPT conversation about IA#2 — Zero-downtime migration, through 2026-10-14. This is a task summary, not a chat transcript. Any actual student-run commands, failures, fixes, and evidence must be added after execution.

## Usage

- Add **one entry per task** where an AI assistant contributed to the work.
- Keep entries concise and factual; this is an account of what happened, not a transcript.
- Record what you **kept, changed, rejected, and wrote by hand**.
- You remain responsible for all submitted work and should be able to explain it.
- Do not include secrets, API keys, real user data, or another student's work in prompts.
- If your product itself uses an LLM, state what data leaves the system and why that is acceptable.

---

## 2026-10-13 — Understanding the assignment and grading rubric

**Tool:** ChatGPT (Superpowers and Matt Pocock skills requested)  
**Asked for:** Read the IA#2 prompt, attached rubric, course material, and starter repository; identify every implementation and submission requirement.  
**Kept:** The required `price` (thousands of VND, float) to `price_vnd` (VND, integer) conversion, two-instance zero-downtime constraint, one continuous traffic run, rollback demonstration, version tags, migrations, and required evidence files.  
**Changed:** Refined the task into a staged implementation plan rather than treating it as a simple column rename.  
**Rejected:** A one-step rename/type change because it breaks compatibility with the old running application.  
**By hand:** Supplied the assignment, rubric, and course materials, and requested the requirement breakdown; no local implementation was reported at this stage.

---

## 2026-10-14 — Researching and planning the migration sequence

**Tool:** ChatGPT (Superpowers and Matt Pocock skills requested)  
**Asked for:** Research the starter implementation and provide a detailed end-to-end migration procedure.  
**Kept:** Expand → dual-write → backfill → read-new → rollback → stop-old → contract, with distinct `v1`–`v4` code versions, rolling deployment, and a named point of no return.  
**Changed:** Made schema/code compatibility, `migrate:down` verification, and checks after each deployment explicit; accounted for old clients still receiving `price` after the SQL column is dropped.  
**Rejected:** Dropping `price` before every instance has stopped using it; rolling back to a version that reads stale `price` after new-only writes begin.  
**By hand:** Requested an end-to-end workflow and retained responsibility for independently reviewing each migration before execution; no student-run migration was reported in the conversation.

---

## 2026-10-14 — Defining manual execution and evidence collection

**Tool:** ChatGPT (Superpowers and Matt Pocock skills requested)  
**Asked for:** Make the guide executable step by step, with evidence collected during each manual action rather than copied into logs afterward.  
**Kept:** PowerShell terminal commands using `Tee-Object -Append` and labelled check sections, the starter traffic process writing its own log, and separate terminals for two servers, traffic, and migration control.  
**Changed:** Required an execution guide that combines implementation instructions, actual commands, expected output, PASS/FAIL checks, and immediate log capture in the correct sequence.  
**Rejected:** `run-step1`/`run-all`-style automation, scripted execution of the whole assignment, fabricated logs, and manual copying of terminal output into evidence files.  
**By hand:** Explicitly defined the no-step-runner requirement and decided to execute migrations, deploys, rollback, tests, and ZIP submission personally.

---

## 2026-10-14 — Preparing application versions and schema migrations

**Tool:** ChatGPT (Superpowers and Matt Pocock skills requested)  
**Asked for:** Prepare a workspace with the source changes, migrations, tests, and Git versions needed for the assignment.  
**Kept:** AI-generated `v2` dual-write API changes, `v3` canonical `price_vnd` reads with dual writes, `v4` new-only SQL access with legacy HTTP `price` support, and `002`/`003` `.up.sql` and `.down.sql` files.  
**Changed:** The assistant reported adding Windows-safe migration paths and targeted migration execution to prevent the final contract migration from being applied too early.  
**Rejected:** Renaming the old column in place, removing the old API field, and changing `order_items.unit_price`, which was outside assignment scope.  
**By hand:** No student-authored source change or local Git command was established in this conversation; these are AI-prepared artifacts requiring my review and independent execution.

---

## 2026-10-14 — Preparing backfill, live traffic, and rollback verification

**Tool:** ChatGPT (Superpowers and Matt Pocock skills requested)  
**Asked for:** Support short-transaction, re-runnable backfill; a single uninterrupted traffic run; and an actual rollback path with verifiable evidence.  
**Kept:** AI-generated `scripts/backfill.js` using batches and reconciling both `NULL` and stale non-`NULL` values; the `v3 → v2 → v3` rollback plan; and a manual gate for activating new-client traffic without restarting the process.  
**Changed:** Improved the proposed backfill so it can also repair disagreement caused by writes from v1 during mixed-version deployment. Distinguished expected temporary legacy-column inconsistency from unacceptable inconsistency after backfill.  
**Rejected:** Backfilling while v1 still writes only `price`, changing traffic failure counters to hide errors, and treating HTTP 200 alone as proof of correctness.  
**By hand:** Specified that all rollout, backfill, rollback, and verification commands must be run manually. No student-generated `traffic-log.txt` or `check-log.txt` was presented in the conversation.

---

## 2026-10-14 — Testing, documenting, and handing over the workspace

**Tool:** ChatGPT (Superpowers and Matt Pocock skills requested)  
**Asked for:** Deliver all prepared files plus an execution guide that produces the evidence required by the rubric, leaving final ZIP creation and submission to me.  
**Kept:** AI-prepared `EXECUTION_GUIDE.md`, `MIGRATION.md`, code/test files, blank evidence files, and `SELF_ASSESSMENT_REPORT.md` with fields to complete from real results. The assistant reported internal Linux tests for `v1`–`v4`, migration-down checks, and a separate traffic rehearsal with 73,771 successful requests and zero counted failures.  
**Changed:** Explicitly separated the assistant's rehearsal from my own required Windows execution and evidence; left self-assessment marks, log line numbers, and actual student results unclaimed.  
**Rejected:** Submitting the assistant's rehearsal as my traffic evidence, inventing verification results, and having the assistant choose the final student-ID ZIP name or submit the work.  
**By hand:** Confirmed that I will run the procedure, inspect and collect real logs, complete my self-assessment, create the ZIP, and submit it. **Those actions have not been verified in this conversation.**

---

## 2026-10-14 — Preparing this AI usage log

**Tool:** ChatGPT  
**Asked for:** Convert this conversation into the provided `AI-LOG.md` template and export it as a Markdown file.  
**Kept:** A concise, task-based summary using the template's `Tool`, `Asked for`, `Kept`, `Changed`, `Rejected`, and `By hand` fields.  
**Changed:** Condensed the conversation into task entries instead of reproducing messages verbatim; distinguished assistant-generated work from student-performed work.  
**Rejected:** Unsupported claims that I personally executed the migrations, completed the traffic test, or obtained submission-ready evidence.  
**By hand:** Provided the template and requested this conversion; I still need to review the log for accuracy and update it with any later work before submission.

---

**Final verification status:** AI-generated code, documents, and an assistant-run rehearsal were discussed and delivered in the conversation. **My own Windows implementation, one continuous traffic run, rollback evidence, and final score are not established by this conversation and must not be claimed without actual logs.**
