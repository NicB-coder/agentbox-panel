// Connectors: apps agents may use through Claude Code's MCP support.
// Most come from claude.ai (Settings → Connectors on the same Claude account Claude Code is signed in with)
// and show up in Claude Code by themselves as "claude.ai <Name>". GitHub works through the bot's own gh login.
// Per task, Nic ticks which ones it may use; every other connector is blocked for that run.

export type ConnectorDef = { id: string; name: string; server: string | null; what: string; asks: string };

export const CONNECTORS: ConnectorDef[] = [
  { id: "gmail", name: "Gmail", server: "claude_ai_Gmail", what: "Read and search your email, and write drafts.", asks: "Sending, replying, forwarding or deleting email" },
  { id: "calendar", name: "Google Calendar", server: "claude_ai_Google_Calendar", what: "See your calendar and find free time.", asks: "Adding, changing or deleting events, and answering invites" },
  { id: "drive", name: "Google Drive", server: "claude_ai_Google_Drive", what: "Find and read your files, and make new ones.", asks: "Sharing, changing or deleting files" },
  { id: "sheets", name: "Google Sheets", server: "claude_ai_Google_Sheets", what: "Read your spreadsheets and add to them.", asks: "Changing or clearing what's already there" },
  { id: "docs", name: "Claude Docs", server: "claude_ai_Claude_Docs", what: "Read and write your Claude Docs.", asks: "Sharing or deleting docs" },
  { id: "slack", name: "Slack", server: "claude_ai_Slack", what: "Read and search your Slack channels and messages.", asks: "Sending or deleting messages" },
  { id: "notion", name: "Notion", server: "claude_ai_Notion", what: "Read and search your Notion pages.", asks: "Changing, moving or deleting pages" },
  { id: "github", name: "GitHub", server: null, what: "Your projects, pull requests and issues (through the bot's GitHub account). Always on.", asks: "Merging always waits for you" },
  { id: "linear", name: "Linear", server: "claude_ai_Linear", what: "Read and search your issues and projects.", asks: "Creating, changing or closing issues" },
  { id: "figma", name: "Figma", server: "claude_ai_Figma", what: "Look at your designs to build from them.", asks: "Changing designs" },
  { id: "canva", name: "Canva", server: "claude_ai_Canva", what: "Find and read your designs.", asks: "Changing or deleting designs" },
];

// Tool names that send, delete, book or change something someone else sees. These always ask Nic first.
export const RISKY_TOOL = /(send|reply|forward|delete|trash|remove|share|create_event|update_event|delete_event|respond|book|post_message|post|publish|invite|archive|move|update_page|update_values|clear|batch_clear|pay|purchase|transfer|merge)/i;

// Blocks every connector this run wasn't given (the known ones, and any others found on this Mac).
export function connectorDenies(allowed: string[]): string[] {
  const known = CONNECTORS.filter((c) => c.server && !allowed.includes(c.id)).map((c) => `mcp__${c.server}`);
  const extra = (globalThis as { __connectorExtra?: { id: string; server: string }[] }).__connectorExtra ?? [];
  return [...known, ...extra.filter((c) => !allowed.includes(c.id)).map((c) => `mcp__${c.server}`)];
}

// "claude.ai Google Calendar" → "claude_ai_Google_Calendar" (how Claude Code names its tools).
export const serverKey = (name: string) => name.replace(/[^A-Za-z0-9_-]+/g, "_");
