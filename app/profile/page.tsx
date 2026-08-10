"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { PatientSelector } from "@/app/chat/_components/patient-selector";
import { ProfileSummaryPanel } from "@/app/chat/_components/profile-summary-panel";
import type { ShowcasePatientOption } from "@/lib/showcase/patient-options";
import { type PatientProfileSummary } from "@/lib/showcase/profile-summary";
import {
  classifyProfileLoadFailure,
  type ProfileLoadFailure
} from "@/lib/showcase/profile-load-failure";

const PROFILE_SESSION_KEY = "profile.selectedProfileId";

export default function ProfilePage() {
  const [patientOptions, setPatientOptions] = useState<ShowcasePatientOption[]>([]);
  const [confirmedProfileId, setConfirmedProfileId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PatientProfileSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);
  const [loadFailure, setLoadFailure] = useState<ProfileLoadFailure | null>(null);
  const [reloadCounter, setReloadCounter] = useState<number>(0);

  // Load saved profile ID from session storage
  useEffect(() => {
    const stored = sessionStorage.getItem(PROFILE_SESSION_KEY);
    if (stored) {
      setConfirmedProfileId(stored);
    }
  }, []);

  // Load available patient options
  useEffect(() => {
    let isCancelled = false;

    async function loadPatientOptions() {
      try {
        const response = await fetch("/api/patient-profile/options", { cache: "no-store" });
        const body = await response.json();

        if (!response.ok || !body?.data?.options || !Array.isArray(body.data.options)) {
          return;
        }

        if (isCancelled) {
          return;
        }

        const options = body.data.options as ShowcasePatientOption[];
        if (options.length > 0) {
          setPatientOptions(options);
        }
      } catch {
        if (!isCancelled) {
          setPatientOptions([]);
        }
      }
    }

    void loadPatientOptions();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Load profile summary when profile is selected
  useEffect(() => {
    let isCancelled = false;

    async function loadSummary(profileId: string): Promise<void> {
      setSummary(null);
      setLoadFailure(null);
      setIsSummaryLoading(true);

      try {
        const response = await fetch(
          `/api/patient-profile?profileId=${encodeURIComponent(profileId)}`,
          { cache: "no-store" }
        );
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body?.error?.message ?? "PROFILE_SUMMARY_NOT_FOUND");
        }

        const payload = body?.data?.summary as PatientProfileSummary | undefined;
        if (!payload) {
          throw new Error("PROFILE_SUMMARY_NOT_FOUND");
        }

        if (isCancelled) {
          return;
        }

        setSummary(payload);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setSummary(null);
        setLoadFailure(classifyProfileLoadFailure(error));
      } finally {
        if (!isCancelled) {
          setIsSummaryLoading(false);
        }
      }
    }

    if (!confirmedProfileId) {
      setSummary(null);
      setLoadFailure(null);
      setIsSummaryLoading(false);
      return;
    }

    void loadSummary(confirmedProfileId);

    return () => {
      isCancelled = true;
    };
  }, [confirmedProfileId, reloadCounter]);

  function handleConfirmSelection(profileId: string): void {
    setConfirmedProfileId(profileId);
    sessionStorage.setItem(PROFILE_SESSION_KEY, profileId);
  }

  function handleRetryProfileLoad(): void {
    setLoadFailure(null);
    setIsSummaryLoading(true);
    // Reload counter will trigger useEffect again
    setReloadCounter((prev) => prev + 1);
  }

  const selectedProfile = useMemo(() => {
    if (!confirmedProfileId) {
      return null;
    }

    return patientOptions.find((option) => option.profileId === confirmedProfileId) ?? null;
  }, [confirmedProfileId, patientOptions]);

  return (
    <main className="profile-page-main">
      <div className="profile-page-container">
        <h1>Patient Profile Browser</h1>
        <p>
          Browse and review synthetic patient profiles. Select a patient to view their complete
          profile including conditions, medications, appointments, and care plan details.
        </p>

        <div className="profile-page-layout">
          <div className="profile-selector-section">
            <PatientSelector
              options={patientOptions}
              confirmedProfileId={confirmedProfileId}
              onConfirmSelection={handleConfirmSelection}
            />

            {selectedProfile && (
              <div className="profile-action-buttons">
                <Link href="/chat" className="button button-primary">
                  Start Chat with {selectedProfile.label}
                </Link>
              </div>
            )}
          </div>

          <div className="profile-summary-section">
            {selectedProfile ? (
              <ProfileSummaryPanel
                profileLabel={selectedProfile.label}
                summary={summary}
                isLoading={isSummaryLoading}
                loadFailure={loadFailure}
                onRetry={handleRetryProfileLoad}
              />
            ) : (
              <div className="profile-empty-state">
                <p>Select a patient profile to view their summary</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}