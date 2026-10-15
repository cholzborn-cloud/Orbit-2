import { syncEnvVars } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_ghnnfyqsaasakkywwund",
  runtime: "node-24",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./trigger"],
  build: {
    extensions: [
      // Tasks laufen in der Trigger-Cloud und lesen .env.local nicht.
      syncEnvVars(async (ctx) => {
        const get = (name: string) => ctx.env[name] ?? process.env[name];
        const vars = [
          { name: "OPENROUTER_API_KEY", value: get("OPENROUTER_JEV_API_KEY") },
          ...["DAYTONA_API_KEY", "DAYTONA_API_URL", "CLI_PROXY_API_KEY", "DATABASE_URL"].map((name) => ({
            name,
            value: get(name),
          })),
        ];
        return vars.filter((v): v is { name: string; value: string } => !!v.value);
      }),
    ],
  },
});
