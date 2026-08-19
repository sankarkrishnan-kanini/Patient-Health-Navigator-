import { exportShowcaseProfileSummaries } from "@/lib/data-ingestion/showcase-profile-summary";
import { invalidatePatientProfileCaches } from "@/lib/cache";

type CliArgs = {
  completenessRunId: string;
  runId?: string;
  schemaVersion?: string;
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

    if (token === "--schema-version") {
      args.schemaVersion = next ?? undefined;
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
  const summary = await exportShowcaseProfileSummaries(args);
  const invalidation = await invalidatePatientProfileCaches();

  console.log(
    JSON.stringify(
      {
        ...summary,
        cacheInvalidation: invalidation
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown profile summary export failure.";
  console.error(message);
  process.exit(1);
});
