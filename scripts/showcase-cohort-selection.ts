import { buildShowcaseCohort } from "@/lib/data-ingestion/showcase-cohort-selection";

type CliArgs = {
  sourceRunId: string;
  runId?: string;
  normalizedRootPath?: string;
  outputRootPath?: string;
  minProfiles?: number;
  maxProfiles?: number;
};

function parseNumber(value: string | undefined, argumentName: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric value for ${argumentName}: ${value}`);
  }

  return parsed;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { sourceRunId: "" };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--source-run-id") {
      args.sourceRunId = next ?? "";
      index += 1;
      continue;
    }

    if (token === "--run-id") {
      args.runId = next ?? undefined;
      index += 1;
      continue;
    }

    if (token === "--normalized-root") {
      args.normalizedRootPath = next ?? undefined;
      index += 1;
      continue;
    }

    if (token === "--output-root") {
      args.outputRootPath = next ?? undefined;
      index += 1;
      continue;
    }

    if (token === "--min-profiles") {
      args.minProfiles = parseNumber(next, "--min-profiles");
      index += 1;
      continue;
    }

    if (token === "--max-profiles") {
      args.maxProfiles = parseNumber(next, "--max-profiles");
      index += 1;
    }
  }

  if (!args.sourceRunId) {
    throw new Error("Missing required argument --source-run-id <normalized-run-id>.");
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await buildShowcaseCohort(args);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown cohort generation failure.";
  console.error(message);
  process.exit(1);
});
