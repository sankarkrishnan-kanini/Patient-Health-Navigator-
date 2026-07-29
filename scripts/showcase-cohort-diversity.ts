import {
  applyShowcaseCohortDiversityRules,
  type ClinicalScenarioCategory
} from "@/lib/data-ingestion/showcase-cohort-diversity";

type CliArgs = {
  cohortRunId: string;
  runId?: string;
  curatedRootPath?: string;
  outputRootPath?: string;
  requiredCategories?: ClinicalScenarioCategory[];
  maxCategoryShare?: number;
};

function parseNumber(value: string | undefined, argumentName: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric value for ${argumentName}: ${value}`);
  }

  return parsed;
}

function parseCategories(value: string | undefined): ClinicalScenarioCategory[] | undefined {
  if (!value) {
    return undefined;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0) as ClinicalScenarioCategory[];
}

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

    if (token === "--required-categories") {
      args.requiredCategories = parseCategories(next);
      index += 1;
      continue;
    }

    if (token === "--max-category-share") {
      args.maxCategoryShare = parseNumber(next, "--max-category-share");
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
  const summary = await applyShowcaseCohortDiversityRules(args);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown diversity rule execution failure.";
  console.error(message);
  process.exit(1);
});
