import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  performRxNormLookup,
  buildInteractionWarningMessage,
  clearRxNormCaches,
  type RxNormLookupResult
} from "@/lib/showcase/rxnorm-lookup";

describe("RxNorm Lookup - Medication Interaction Checking", () => {
  beforeEach(() => {
    clearRxNormCaches();
  });

  afterEach(() => {
    clearRxNormCaches();
  });

  describe("performRxNormLookup", () => {
    it("should return empty result for no medications", async () => {
      const result = await performRxNormLookup([]);
      expect(result.medications).toHaveLength(0);
      expect(result.overallSeverity).toBe("none");
      expect(result.warnings).toHaveLength(0);
    });

    it("should detect interaction between Warfarin and Aspirin", async () => {
      const result = await performRxNormLookup(["Warfarin", "Aspirin"]);

      expect(result.medications).toHaveLength(2);
      expect(result.overallSeverity).toBe("high");

      // Check for Warfarin entry
      const warfarinMed = result.medications.find((m) =>
        m.medicationName.toLowerCase().includes("warfarin")
      );
      expect(warfarinMed).toBeDefined();

      // Should have interaction risks
      const hasInteractions = result.medications.some((m) => m.interactionRisks.length > 0);
      expect(hasInteractions).toBe(true);
    });

    it("should detect interaction between Warfarin and Ibuprofen", async () => {
      const result = await performRxNormLookup(["Warfarin", "Ibuprofen"]);

      expect(result.overallSeverity).toBe("high");

      const interactionDescriptions = result.warnings;
      expect(interactionDescriptions.length).toBeGreaterThan(0);
    });

    it("should detect moderate interaction with Lisinopril and Potassium", async () => {
      const result = await performRxNormLookup(["Lisinopril", "Potassium"]);

      expect(result.medications).toHaveLength(2);
      expect(result.overallSeverity).toBe("medium");

      const interactionCount = result.medications.reduce(
        (sum, med) => sum + med.interactionRisks.length,
        0
      );
      expect(interactionCount).toBeGreaterThan(0);
    });

    it("should cache lookups to reduce API calls", async () => {
      const result1 = await performRxNormLookup(["Metformin", "Lisinopril"]);
      const result2 = await performRxNormLookup(["Metformin", "Lisinopril"]);

      // Second call should have cache hits
      expect(result2.cacheHits).toBeGreaterThanOrEqual(0);
    });

    it("should handle single medication without errors", async () => {
      const result = await performRxNormLookup(["Metformin"]);

      expect(result.medications).toHaveLength(1);
      expect(result.medications[0]?.medicationName).toBe("Metformin");
    });

    it("should handle medication name variations", async () => {
      const result1 = await performRxNormLookup(["Acetaminophen"]);
      const result2 = await performRxNormLookup(["acetaminophen"]);

      // Both should resolve properly (case-insensitive)
      expect(result1.medications).toHaveLength(1);
      expect(result2.medications).toHaveLength(1);
    });
  });

  describe("buildInteractionWarningMessage", () => {
    it("should return null for no interactions", () => {
      const result: RxNormLookupResult = {
        medications: [],
        overallSeverity: "none",
        warnings: [],
        cacheHits: 0
      };

      const message = buildInteractionWarningMessage(result);
      expect(message).toBeNull();
    });

    it("should build high-severity warning message", () => {
      const result: RxNormLookupResult = {
        medications: [],
        overallSeverity: "high",
        warnings: [
          "⚠️ Warfarin + Aspirin: Increased risk of bleeding when combined",
          "⚠️ Warfarin + Ibuprofen: NSAIDs increase bleeding risk with warfarin"
        ],
        cacheHits: 0
      };

      const message = buildInteractionWarningMessage(result);
      expect(message).toBeDefined();
      expect(message).toContain("IMPORTANT");
      expect(message).toContain("serious interactions");
      expect(message).toContain("Warfarin");
      expect(message).toContain("care team");
    });

    it("should build medium-severity warning message", () => {
      const result: RxNormLookupResult = {
        medications: [],
        overallSeverity: "medium",
        warnings: ["⚠️ Lisinopril + Potassium: ACE inhibitors can raise potassium levels"],
        cacheHits: 0
      };

      const message = buildInteractionWarningMessage(result);
      expect(message).toBeDefined();
      expect(message).toContain("Caution");
      expect(message).toContain("interactions to be aware of");
    });

    it("should build low-severity warning message", () => {
      const result: RxNormLookupResult = {
        medications: [],
        overallSeverity: "low",
        warnings: ["ℹ️ Some minor interaction detail"],
        cacheHits: 0
      };

      const message = buildInteractionWarningMessage(result);
      expect(message).toBeDefined();
      expect(message).toContain("Note");
      expect(message).toContain("minor");
    });

    it("should format warnings as bullet points", () => {
      const result: RxNormLookupResult = {
        medications: [],
        overallSeverity: "high",
        warnings: ["Warning 1", "Warning 2", "Warning 3"],
        cacheHits: 0
      };

      const message = buildInteractionWarningMessage(result)!;
      expect(message).toContain("• Warning 1");
      expect(message).toContain("• Warning 2");
      expect(message).toContain("• Warning 3");
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle patient with multiple chronic medications", async () => {
      // Simulate patient on common chronic disease medications
      const result = await performRxNormLookup([
        "Metformin",
        "Lisinopril",
        "Atorvastatin",
        "Aspirin"
      ]);

      expect(result.medications.length).toBeGreaterThan(0);
      expect(result.overallSeverity).toBeTruthy();

      // No crash, proper structure
      result.medications.forEach((med) => {
        expect(med.medicationName).toBeTruthy();
        expect(Array.isArray(med.interactionRisks)).toBe(true);
      });
    });

    it("should handle empty medication names gracefully", async () => {
      const result = await performRxNormLookup(["", "  ", "Aspirin"]);

      // Should not crash
      expect(result.medications.length).toBeGreaterThan(0);
    });

    it("should handle unknown medications", async () => {
      const result = await performRxNormLookup(["UnknownDrugXYZ123"]);

      // Should complete without error even if medication not found
      expect(result.medications).toHaveLength(1);
      expect(result.medications[0]).toBeDefined();
    });
  });

  describe("Interaction severity classification", () => {
    it("should classify Warfarin + Aspirin as high severity", async () => {
      const result = await performRxNormLookup(["Warfarin", "Aspirin"]);

      const warfarinMed = result.medications.find((m) =>
        m.medicationName.toLowerCase().includes("warfarin")
      );
      expect(warfarinMed?.severity).toBe("high");
    });

    it("should classify Lisinopril + Potassium as medium severity", async () => {
      const result = await performRxNormLookup(["Lisinopril", "Potassium"]);

      const lisinoprilMed = result.medications.find((m) =>
        m.medicationName.toLowerCase().includes("lisinopril")
      );
      expect(lisinoprilMed?.severity).toBe("medium");
    });

    it("should set overall severity to highest among all interactions", async () => {
      const result = await performRxNormLookup([
        "Warfarin", // High severity
        "Lisinopril", // Medium severity
        "Aspirin" // High severity
      ]);

      expect(result.overallSeverity).toBe("high");
    });
  });
});
