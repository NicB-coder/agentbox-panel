// Runs once when the server starts: restore state and start the scheduler.
// A version being test-started by the updater (AGENTBOX_NO_BACKGROUND=1) must not start or watch any runs.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.AGENTBOX_NO_BACKGROUND !== "1") {
    const { startBackground } = await import("./lib/scheduler");
    startBackground();
  }
}
