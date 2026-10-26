// v3.1 milestone 3: briefs that just work. Run with: npm test
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

// A pretend home: ~/projects/lookout (with a GitHub stand-in) and the panel's data, all in a temp folder.
const home = fs.mkdtempSync(path.join(os.tmpdir(), "agentbox-briefs-test-"));
process.env.HOME = home;
Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", GH_TOKEN: "", GITHUB_TOKEN: "" });
process.env.AGENTBOX_DATA_DIR = path.join(home, "data");
fs.mkdirSync(process.env.AGENTBOX_DATA_DIR, { recursive: true });

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const origin = path.join(home, "origin.git");
const projects = path.join(home, "projects");
const lookout = path.join(projects, "lookout");
fs.mkdirSync(projects, { recursive: true });
git(home, "init", "--bare", "-b", "main", origin);
git(home, "clone", "-q", origin, path.join(home, "seed"));
fs.writeFileSync(path.join(home, "seed", "README.md"), "# Lookout\n");
fs.mkdirSync(path.join(home, "seed", "docs"));
fs.writeFileSync(path.join(home, "seed", "docs", "plan.md"), "The plan\n");
git(path.join(home, "seed"), "add", "-A");
git(path.join(home, "seed"), "commit", "-qm", "first");
git(path.join(home, "seed"), "push", "-q", "origin", "HEAD:main");
git(home, "clone", "-q", origin, lookout);

const briefs = await import("../lib/briefs");
const wf = await import("../lib/wf");
const db = await import("../lib/db");
const { context } = await import("../lib/workflowRunner");
const { inboxItems } = await import("../lib/inbox");
const files = await import("../lib/projectFiles");
import type { WfStep, WorkflowRun } from "../lib/types";

const BRIEF = "# Lookout — v0.1 beta\n\nAn app that watches the web.\n\n## Must have\n- a list\n";

describe("attaching a brief", () => {
  test("it's kept by its content and shown as name · lines", () => {
    const b = briefs.storeBrief("../../Lookout brief.md", BRIEF);
    assert.equal(b.name, "Lookout brief.md", "no folders in the name");
    assert.equal(b.lines, 6);
    assert.match(b.hash, /^[a-f0-9]{24}$/);
    assert.equal(briefs.readStoredBrief(b.hash), BRIEF);
    assert.equal(briefs.storeBrief("again.md", BRIEF).hash, b.hash, "same text, same brief");
    assert.equal(wf.briefLabel(b), "Lookout brief.md · 6 lines");
    assert.equal(wf.briefLabel({ name: "a.md", lines: 1 }), "a.md · 1 line");
  });
  test("only text files, not empty, not huge", () => {
    assert.throws(() => briefs.storeBrief("photo.png", "x"), /Markdown/);
    assert.throws(() => briefs.storeBrief("a.md", "  \n"), /empty/);
    assert.throws(() => briefs.storeBrief("a.md", "x".repeat(400_001)), /too big/);
    assert.equal(briefs.readStoredBrief("../../etc/passwd"), null);
  });
  test("a workflow keeps its brief through a save (and drops a broken one)", () => {
    const b = briefs.storeBrief("CLAUDE.md", BRIEF);
    const steps = wf.cleanSteps([{ id: "s0", type: "start", task: "Build Lookout", brief: b }, { id: "s1", type: "agent", prompt: "Build it" }], []);
    assert.deepEqual(steps[0].brief, b);
    const bad = wf.cleanSteps([{ id: "s0", type: "start", brief: { name: "x.md", hash: "nope" } }], []);
    assert.equal(bad[0].brief, undefined);
  });
});

describe("the brief is copied into the run's copy", () => {
  const wt = (name: string) => {
    const dir = path.join(home, "worktrees", name);
    git(lookout, "worktree", "add", "-q", "-b", `agent/${name}`, dir, "origin/main");
    return dir;
  };

  test("as CLAUDE.md when the project has none, and the panel's commits leave it out", () => {
    const dir = wt("one");
    assert.equal(briefs.placeBrief(dir, BRIEF), "CLAUDE.md");
    assert.equal(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8"), BRIEF);
    assert.equal(briefs.placedBrief(dir), "CLAUDE.md");
    // A run that changed nothing else: nothing gets committed, so it still counts as "no changes".
    git(dir, ...briefs.addAllArgs(dir));
    assert.equal(git(dir, "diff", "--cached", "--name-only"), "");
    // Real work is committed, the brief still isn't.
    fs.writeFileSync(path.join(dir, "app.js"), "1");
    git(dir, ...briefs.addAllArgs(dir));
    assert.equal(git(dir, "diff", "--cached", "--name-only"), "app.js");
    // A follow-up in the same copy puts it in the same place again.
    assert.equal(briefs.placeBrief(dir, BRIEF + "more\n"), "CLAUDE.md");
  });

  test("as BRIEF.md when the project has its own CLAUDE.md", () => {
    const dir = wt("two");
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "the project's own\n");
    assert.equal(briefs.placeBrief(dir, BRIEF), "BRIEF.md");
    assert.equal(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8"), "the project's own\n", "never overwrites the project's file");
    assert.match(briefs.briefPromptLine("Lookout.md", "BRIEF.md"), /Follow BRIEF\.md in the repo root/);
    assert.match(briefs.briefPromptLine("Lookout.md", "BRIEF.md"), /Nic's file "Lookout\.md"/);
  });

  test("every workflow step is told to follow it", () => {
    const dir = wt("three");
    briefs.placeBrief(dir, BRIEF);
    const b = briefs.storeBrief("Lookout.md", BRIEF);
    const steps: WfStep[] = [
      { id: "s0", type: "start", trigger: "manual", task: "Build Lookout", brief: b },
      { id: "s1", type: "agent", agentId: null, prompt: "Build it" },
    ];
    const wfRow = db.createWorkflow({ name: "Lookout", project: "lookout", steps, limits: { maxLoops: 2, maxMinutes: 60, maxUsagePct: 50 } }, "test");
    const wr = { ...db.createWfRun({ workflowId: wfRow.id, status: "running", test: false, input: "", trigger: "manual", triggerRef: null, steps, stepRuns: {} }), worktree: dir } as WorkflowRun;
    const told = context(wr, wfRow, steps[1]);
    assert.match(told, /Follow CLAUDE\.md in the repo root/);
    assert.match(told, /Build Lookout/);
  });
});

describe("before a run starts: is every file the goal mentions there?", () => {
  test("it spots files to follow, not files to make", () => {
    assert.deepEqual(briefs.mentionedFiles("Follow CLAUDE.md in the repo root."), ["CLAUDE.md"]);
    assert.deepEqual(briefs.mentionedFiles("Build the app described in docs/spec.md, please"), ["docs/spec.md"]);
    assert.deepEqual(briefs.mentionedFiles("Read `notes.txt` first"), ["notes.txt"]);
    assert.deepEqual(briefs.mentionedFiles("Write a README.md for it"), []);
    assert.deepEqual(briefs.mentionedFiles("Create CLAUDE.md with the rules"), []);
    assert.deepEqual(briefs.mentionedFiles("Make an arcade website with 4 games"), []);
    assert.deepEqual(briefs.mentionedFiles("Put the games in index.html"), []);
  });

  test("a file that's missing everywhere stops it, in plain words", async () => {
    const m = await briefs.missingFile("lookout", ["Build Lookout. Follow CLAUDE.md in the repo root."]);
    assert.deepEqual(m && { file: m.file, project: m.project }, { file: "CLAUDE.md", project: "lookout" });
    assert.equal(m!.message, "I can't find CLAUDE.md in lookout. Attach it here or add it to the project, then start it again.");
  });

  test("files in the project, or the attached brief, are fine", async () => {
    assert.equal(await briefs.missingFile("lookout", ["Follow README.md"]), null);
    assert.equal(await briefs.missingFile("lookout", ["Read plan.md and build it"]), null, "found in a folder by its name");
    assert.equal(await briefs.missingFile("lookout", ["Follow CLAUDE.md"], "lookout-brief.md"), null, "the brief is copied in as CLAUDE.md");
    assert.equal(await briefs.missingFile("lookout", ["Follow the plan in spec.md"], "spec.md"), null);
    assert.equal(await briefs.missingFile("lookout", ["Make a game"]), null);
  });

  test("a file added on GitHub (not on this Mac yet) counts too", async () => {
    const seed = path.join(home, "seed");
    fs.writeFileSync(path.join(seed, "SPEC.md"), "spec\n");
    git(seed, "add", "-A");
    git(seed, "commit", "-qm", "spec");
    git(seed, "push", "-q", "origin", "HEAD:main");
    assert.equal(fs.existsSync(path.join(lookout, "SPEC.md")), false);
    assert.equal(await briefs.missingFile("lookout", ["Follow SPEC.md"]), null);
  });

  test("\"This project has a brief ✓\" sees a CLAUDE.md here or on GitHub", async () => {
    assert.equal(await briefs.projectBrief("lookout"), null);
    const seed = path.join(home, "seed");
    fs.writeFileSync(path.join(seed, "CLAUDE.md"), "rules\nmore\n");
    git(seed, "add", "-A");
    git(seed, "commit", "-qm", "brief");
    git(seed, "push", "-q", "origin", "HEAD:main");
    git(lookout, "fetch", "-q", "origin");
    const b = await briefs.projectBrief("lookout");
    assert.deepEqual(b && { name: b.name, lines: b.lines }, { name: "CLAUDE.md", lines: 2 });
  });
});

describe("Projects → Add a file", () => {
  test("safe names and a files/<name> branch", () => {
    assert.equal(files.cleanFileName("../CLAUDE.md"), "CLAUDE.md");
    assert.equal(files.cleanFileName(".env"), null, "no hidden files");
    assert.equal(files.cleanFileName("noext"), null);
    assert.equal(files.branchFor("CLAUDE.md"), "files/claude-md");
  });

  test("the file goes on its own branch as one commit, and the copy is tidied up", async () => {
    // There's no real GitHub here, so the pull request can't open: everything before that still happens.
    await assert.rejects(files.addFile("lookout", "Lookout brief.md", Buffer.from(BRIEF)), /pull request didn't open/);
    const remote = git(lookout, "ls-remote", "--heads", "origin", "files/lookout-brief-md");
    assert.match(remote, /refs\/heads\/files\/lookout-brief-md/);
    assert.equal(git(lookout, "show", "origin/files/lookout-brief-md:Lookout brief.md").trim(), BRIEF.trim());
    assert.equal(git(lookout, "log", "--format=%s", "-1", "origin/files/lookout-brief-md"), "Add Lookout brief.md");
    assert.doesNotMatch(git(lookout, "worktree", "list"), /files-lookout-brief-md/);
    assert.equal(git(lookout, "branch", "--list", "files/*"), "", "no local branch left behind");
    // Adding it again picks a fresh branch name.
    await assert.rejects(files.addFile("lookout", "Lookout brief.md", Buffer.from(BRIEF + "v2\n")), /pull request didn't open/);
    assert.match(git(lookout, "ls-remote", "--heads", "origin", "files/lookout-brief-md-2"), /files\/lookout-brief-md-2/);
  });

  test("an open one shows in the Inbox with a Merge button's details", () => {
    db.db().prepare("INSERT INTO file_prs (project, file, branch, pr_url, created_at) VALUES ('lookout', 'CLAUDE.md', 'files/claude-md', 'https://github.com/x/lookout/pull/9', ?)").run(Date.now());
    const it = inboxItems().find((i) => i.kind === "file_pr");
    assert.ok(it && it.kind === "file_pr");
    assert.equal(it.title, "Add CLAUDE.md to lookout");
    assert.equal(it.prUrl, "https://github.com/x/lookout/pull/9");
    assert.match(it.text, /Press Add it to my project to finish/);
  });
});
