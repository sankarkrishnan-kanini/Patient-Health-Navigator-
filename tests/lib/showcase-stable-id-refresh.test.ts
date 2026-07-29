import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  resolveProfileByStableId,
  runShowcaseStableIdRefresh
} from "@/lib/data-ingestion/showcase-stable-id-refresh";

type TestProfile = {
  profileId: string;
  patientId: string;
  sourceRunId: string;
  profileVersion: string;
  sourceFile: string;
};

async function writeCompleteProfiles(rootPath: string, runId: string, profiles: TestProfile[]) {
  const runDirectory = path.join(rootPath, runId);
  await mkdir(runDirectory, { recursive: true });
  await writeFile(path.join(runDirectory, "complete-cohort-profiles.json"), JSON.stringify(profiles, null, 2), "utf8");
}

describe("showcase stable-id refresh", () => {
  it("keeps stable IDs across repeated refresh runs", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "stable-id-refresh-"));
    const completenessRootPath = path.join(tempRoot, "completeness");
    const outputRootPath = path.join(tempRoot, "stable-ids");

    const profiles: TestProfile[] = [
      {
        profileId: "profile-1",
        patientId: "patient-400",
        sourceRunId: "complete-run-1",
        profileVersion: "1.0.0",
        sourceFile: "profiles/patient-400.json"
      },
      {
        profileId: "profile-2",
        patientId: "patient-401",
        sourceRunId: "complete-run-1",
        profileVersion: "1.0.0",
        sourceFile: "profiles/patient-401.json"
      }
    ];

    await writeCompleteProfiles(completenessRootPath, "complete-run-1", profiles);

    const first = await runShowcaseStableIdRefresh({
      completenessRunId: "complete-run-1",
      runId: "refresh-run-1",
      completenessRootPath,
      outputRootPath
    });

    const second = await runShowcaseStableIdRefresh({
      completenessRunId: "complete-run-1",
      runId: "refresh-run-2",
      completenessRootPath,
      outputRootPath
    });

    expect(first.addedCount).toBe(2);
    expect(second.unchangedCount).toBe(2);
    expect(second.addedCount).toBe(0);

    const firstReportRaw = await readFile(first.mappingReportPath, "utf8");
    const secondReportRaw = await readFile(second.mappingReportPath, "utf8");
    const firstReport = JSON.parse(firstReportRaw) as { added: Array<{ stableId: string; patientId: string }> };
    const secondReport = JSON.parse(secondReportRaw) as { unchanged: Array<{ stableId: string; patientId: string }> };

    const stableIdForPatient400First = firstReport.added.find((entry) => entry.patientId === "patient-400")?.stableId;
    const stableIdForPatient400Second = secondReport.unchanged.find((entry) => entry.patientId === "patient-400")?.stableId;

    expect(stableIdForPatient400First).toBeTruthy();
    expect(stableIdForPatient400Second).toBe(stableIdForPatient400First);

    const resolved = await resolveProfileByStableId(String(stableIdForPatient400First), outputRootPath);
    expect(resolved?.patientId).toBe("patient-400");
  });

  it("detects added removed and updated profiles between refresh runs", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "stable-id-refresh-"));
    const completenessRootPath = path.join(tempRoot, "completeness");
    const outputRootPath = path.join(tempRoot, "stable-ids");

    await writeCompleteProfiles(completenessRootPath, "complete-run-a", [
      {
        profileId: "profile-1",
        patientId: "patient-500",
        sourceRunId: "complete-run-a",
        profileVersion: "1.0.0",
        sourceFile: "profiles/patient-500.json"
      },
      {
        profileId: "profile-2",
        patientId: "patient-501",
        sourceRunId: "complete-run-a",
        profileVersion: "1.0.0",
        sourceFile: "profiles/patient-501.json"
      }
    ]);

    await runShowcaseStableIdRefresh({
      completenessRunId: "complete-run-a",
      runId: "refresh-run-a",
      completenessRootPath,
      outputRootPath
    });

    await writeCompleteProfiles(completenessRootPath, "complete-run-b", [
      {
        profileId: "profile-1-updated",
        patientId: "patient-500",
        sourceRunId: "complete-run-b",
        profileVersion: "1.1.0",
        sourceFile: "profiles/patient-500.v2.json"
      },
      {
        profileId: "profile-3",
        patientId: "patient-502",
        sourceRunId: "complete-run-b",
        profileVersion: "1.0.0",
        sourceFile: "profiles/patient-502.json"
      }
    ]);

    const second = await runShowcaseStableIdRefresh({
      completenessRunId: "complete-run-b",
      runId: "refresh-run-b",
      completenessRootPath,
      outputRootPath
    });

    expect(second.addedCount).toBe(1);
    expect(second.removedCount).toBe(1);
    expect(second.updatedCount).toBe(1);

    const secondReportRaw = await readFile(second.mappingReportPath, "utf8");
    const secondReport = JSON.parse(secondReportRaw) as {
      added: Array<{ patientId: string }>;
      removed: Array<{ patientId: string }>;
      updated: Array<{ patientId: string }>;
    };

    expect(secondReport.added.map((entry) => entry.patientId)).toContain("patient-502");
    expect(secondReport.removed.map((entry) => entry.patientId)).toContain("patient-501");
    expect(secondReport.updated.map((entry) => entry.patientId)).toContain("patient-500");
  });
});
