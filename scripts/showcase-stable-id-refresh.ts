import { runShowcaseStableIdRefresh } from "@/lib/data-ingestion/showcase-stable-id-refresh";

type CliArgs = {
  completenessRunId: string;
  runId?: string;
  completenessRootPath?: string;
  outputRootPath?: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { completenessRunId: "" };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--completeness-run-id") {
      args.completenessRunId = next ?? "";
      index += 1;
      continue;
    }

    if (token === "--run-id") {
      args.runId = next ?? undefined;
      index += 1;
      continue;
    }

    if (token === "--completeness-root") {
      args.completenessRootPath = next ?? undefined;
      index += 1;
      continue;
    }

    if (token === "--output-root") {
      args.outputRootPath = next ?? undefined;
      index += 1;
    }
  }

  if (!args.completenessRunId) {
    throw new Error("Missing required argument --completeness-run-id <completeness-run-id>.");
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await runShowcaseStableIdRefresh(args);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown stable-id refresh failure.";
  console.error(message);
  process.exit(1);
});
