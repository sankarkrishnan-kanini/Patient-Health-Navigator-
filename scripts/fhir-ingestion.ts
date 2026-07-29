import { ingestFhirBatch } from "@/lib/data-ingestion/fhir-ingestion";

type CliArgs = {
  inputPath: string;
  runId?: string;
};

function parseArgs(argv: string[]): CliArgs {
  let inputPath = "";
  let runId: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--input") {
      inputPath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (token === "--run-id") {
      runId = argv[index + 1] ?? undefined;
      index += 1;
      continue;
    }
  }

  if (!inputPath) {
    throw new Error("Missing required argument --input <path-to-json-file-or-directory>.");
  }

  return { inputPath, runId };
}

async function main() {
  const { inputPath, runId } = parseArgs(process.argv.slice(2));
  const summary = await ingestFhirBatch({
    inputPath,
    runId
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown ingestion failure.";
  console.error(message);
  process.exit(1);
});
