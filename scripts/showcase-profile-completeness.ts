import { runShowcaseProfileCompletenessGate } from "@/lib/data-ingestion/showcase-profile-completeness";

type CliArgs = {
  cohortRunId: string;
  runId?: string;
  curatedRootPath?: string;
  outputRootPath?: string;
  checklistVersion?: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { cohortRunId: "" };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--cohort-run-id") {
      args.cohortRunId = next ?? "";
      index += 1;
      continue;
    }

    if (token === "--run-id") {
      args.runId = next ?? undefined;
      index += 1;
      continue;
    }

    if (token === "--curated-root") {
      args.curatedRootPath = next ?? undefined;
      index += 1;
      continue;
    }

    if (token === "--output-root") {
      args.outputRootPath = next ?? undefined;
      index += 1;
      continue;
    }

    if (token === "--checklist-version") {
      args.checklistVersion = next ?? undefined;
      index += 1;
    }
  }

  if (!args.cohortRunId) {
    throw new Error("Missing required argument --cohort-run-id <cohort-run-id>.");
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await runShowcaseProfileCompletenessGate(args);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown completeness gate failure.";
  console.error(message);
  process.exit(1);
});
