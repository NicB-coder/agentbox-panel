#!/usr/bin/env node
// Claude Code hook used by every agent run the panel starts.
//
// PreToolUse (Bash): blocks pushes to main/master, force pushes, and any push at all
//   unless the agent is allowed to "Make changes".
// PreToolUse (connectors, mcp__*): anything that sends, deletes or books asks Nic first
//   (and is simply not allowed in Look only).
// PermissionRequest: instead of a terminal prompt (there is none in headless runs), asks Nic
//   in the panel and waits for Allow / Deny.
//
// The panel may restart while a run waits (runs live on under launchd), so every call to it retries.
//
// The panel passes AGENTBOX_URL, AGENTBOX_RUN_ID and AGENTBOX_ALLOWED in the environment.

const url = process.env.AGENTBOX_URL || "http://127.0.0.1:3000";
const runId = process.env.AGENTBOX_RUN_ID;
const allowed = process.env.AGENTBOX_ALLOWED || "suggest";

const out = (o) => process.stdout.write(JSON.stringify(o));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RISKY = /(send|reply|forward|delete|trash|remove|share|create_event|update_event|delete_event|respond|book|post_message|post|publish|invite|archive|move|update_page|update_values|clear|batch_clear|pay|purchase|transfer|merge)/i;

// Asks Nic in the panel and waits for Allow / Deny. Returns { allow, message }.
async function askNic(toolName, toolInput) {
  let id;
  for (let i = 0; i < 60 && !id; i++) {
    try {
      const r = await fetch(`${url}/api/approvals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: Number(runId), toolName, toolInput }),
      });
      if (r.status === 404) return { allow: false, message: "This run isn't active any more." };
      if (!r.ok) throw new Error(String(r.status));
      id = (await r.json()).id;
    } catch {
      await sleep(3000); // the panel is restarting; try again for up to 3 minutes
    }
  }
  if (!id) return { allow: false, message: "Couldn't reach the agentbox panel to ask Nic, so this wasn't allowed." };
  for (;;) {
    await sleep(1500);
    try {
      const r = await fetch(`${url}/api/approvals/${id}`, { cache: "no-store" });
      if (!r.ok) continue;
      const a = await r.json();
      if (a.status === "allowed") return { allow: true };
      if (a.status === "denied") return { allow: false, message: a.message ? `Nic said no: ${a.message}` : "Nic said no. Try a different approach or explain why you need this." };
    } catch {
      /* panel restarting; keep waiting */
    }
  }
}

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

if (input.hook_event_name === "PreToolUse" && String(input.tool_name ?? "").startsWith("mcp__")) {
  const name = String(input.tool_name);
  const tool = name.split("__").slice(2).join("__");
  if (RISKY.test(tool)) {
    const deny = (reason) => out({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } });
    if (allowed === "look") deny("You may only look in this task. Sending, deleting, booking or changing things in connected apps isn't allowed.");
    else if (!runId) deny("No one is there to approve this.");
    else {
      const a = await askNic(name, input.tool_input);
      if (a.allow) out({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: "Nic said yes in the panel." } });
      else deny(a.message);
    }
  }
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
  const a = await askNic(input.tool_name, input.tool_input);
  decide(a.allow, a.message);
  process.exit(0);
}
