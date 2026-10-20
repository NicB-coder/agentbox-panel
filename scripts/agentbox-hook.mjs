#!/usr/bin/env node
// Claude Code hook used by every agent run the panel starts.
//
// PreToolUse (Bash): blocks pushes to main/master, force pushes, and any push at all
//   unless the agent is allowed to "Make changes".
// PermissionRequest: instead of a terminal prompt (there is none in headless runs), asks Nic
//   in the panel and waits for Allow / Deny.
//
// The panel passes AGENTBOX_URL, AGENTBOX_RUN_ID and AGENTBOX_ALLOWED in the environment.

const url = process.env.AGENTBOX_URL || "http://127.0.0.1:3000";
const runId = process.env.AGENTBOX_RUN_ID;
const allowed = process.env.AGENTBOX_ALLOWED || "suggest";

const out = (o) => process.stdout.write(JSON.stringify(o));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

if (input.hook_event_name === "PreToolUse") {
  const cmd = String(input.tool_input?.command ?? "");
  if (/\bgit\b[^;&|]*\bpush\b/.test(cmd)) {
    let reason = null;
    if (allowed !== "make") reason = "You're not allowed to push. Leave your work committed in this folder; the panel sends it for review.";
    else if (/\b(main|master)\b/.test(cmd)) reason = "Pushing to main is never allowed. Push only to your own branch.";
    else if (/(\s--force\b|\s-f\b|--force-with-lease|--mirror|--all|--delete|\s:)/.test(cmd)) reason = "Force pushes and deleting branches aren't allowed.";
    if (reason) {
      out({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });
    }
  }
  process.exit(0);
}

if (input.hook_event_name === "PermissionRequest") {
  const decide = (allow, message) =>
    out({
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: allow ? { behavior: "allow" } : { behavior: "deny", message: message || "Nic said no." },
      },
    });
  if (!runId) {
    decide(false, "No one is there to approve this.");
    process.exit(0);
  }
  let id;
  try {
    const r = await fetch(`${url}/api/approvals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: Number(runId), toolName: input.tool_name, toolInput: input.tool_input }),
    });
    if (!r.ok) throw new Error(String(r.status));
    id = (await r.json()).id;
  } catch {
    decide(false, "Couldn't reach the agentbox panel to ask Nic, so this wasn't allowed.");
    process.exit(0);
  }
  // Wait for Nic's click. The panel kills this run if it's stopped or runs out of time.
  for (;;) {
    await sleep(1500);
    try {
      const r = await fetch(`${url}/api/approvals/${id}`, { cache: "no-store" });
      if (!r.ok) continue;
      const a = await r.json();
      if (a.status === "allowed") {
        decide(true);
        break;
      }
      if (a.status === "denied") {
        decide(false, a.message ? `Nic said no: ${a.message}` : "Nic said no. Try a different approach or explain why you need this.");
        break;
      }
    } catch {
      /* panel restarting; keep waiting */
    }
  }
  process.exit(0);
}
