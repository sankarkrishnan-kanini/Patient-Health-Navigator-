import { normalizeFhirStagedRun } from "@/lib/data-ingestion/fhir-normalization";

type CliArgs = {
  runId: string;
  profileVersion?: string;
};

function parseArgs(argv: string[]): CliArgs {
  let runId = "";
  let profileVersion: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--run-id") {
      runId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (token === "--profile-version") {
      profileVersion = argv[index + 1] ?? undefined;
      index += 1;
      continue;
    }
  }

  if (!runId) {
    throw new Error("Missing required argument --run-id <ingestion-run-id>.");
  }

  return { runId, profileVersion };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await normalizeFhirStagedRun({
    runId: args.runId,
    profileVersion: args.profileVersion
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown normalization failure.";
  console.error(message);
  process.exit(1);
});
