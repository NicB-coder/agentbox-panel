// Starts a Careful task on the dev copy and prints its agent id.
import { BASE } from "./lib.mjs";
const body = JSON.parse(process.argv[2]);
const r = await fetch(`${BASE}/api/tasks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
console.log(r.status, JSON.stringify(await r.json()));
