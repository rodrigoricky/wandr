import { spawnSync } from "node:child_process";

const result = spawnSync("npm", ["run", "build", "-w", "@wandr/web"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: "http://localhost:8787", WANDR_LOCAL_BUILD: "1" },
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
