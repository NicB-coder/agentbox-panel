// Runs once when the server starts: restore state and start the scheduler.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackground } = await import("./lib/scheduler");
    startBackground();
  }
}
