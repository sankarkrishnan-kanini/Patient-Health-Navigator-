"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, UsersRound } from "lucide-react";
import { toast } from "react-toastify";
import type { ShowcasePatientOption } from "@/lib/showcase/patient-options";

const PROFILES_PER_PAGE = 20;

type PatientSelectorProps = {
  options: ShowcasePatientOption[];
  confirmedProfileId: string | null;
  onConfirmSelection: (profileId: string) => void;
};

export function PatientSelector({
  options,
  confirmedProfileId,
  onConfirmSelection
}: PatientSelectorProps) {
  const [pendingProfileId, setPendingProfileId] = useState<string>(confirmedProfileId ?? options[0]?.profileId ?? "");
  const [currentPage, setCurrentPage] = useState<number>(0);
  const legendId = useId();
  const isConfirmDisabled = pendingProfileId.length === 0 || pendingProfileId === confirmedProfileId;
  const pageCount = Math.max(1, Math.ceil(options.length / PROFILES_PER_PAGE));
  const pageStart = currentPage * PROFILES_PER_PAGE;
  const visibleOptions = useMemo(
    () => options.slice(pageStart, pageStart + PROFILES_PER_PAGE),
    [options, pageStart]
  );

  useEffect(() => {
    if (!confirmedProfileId) {
      if (options.length > 0) {
        setPendingProfileId((current) => (current.length > 0 ? current : options[0].profileId));
      }
      return;
    }

    setPendingProfileId(confirmedProfileId);
    const selectedIndex = options.findIndex((option) => option.profileId === confirmedProfileId);
    if (selectedIndex >= 0) {
      setCurrentPage(Math.floor(selectedIndex / PROFILES_PER_PAGE));
    }
  }, [confirmedProfileId, options]);

  useEffect(() => {
    if (currentPage >= pageCount) {
      setCurrentPage(pageCount - 1);
    }
  }, [currentPage, pageCount]);

  function confirmSelection(): void {
    const selectedOption = options.find((option) => option.profileId === pendingProfileId);
    onConfirmSelection(pendingProfileId);
    toast.success(`${selectedOption?.label ?? "Patient profile"} is now active.`);
  }

  return (
    <section className="selector-shell" aria-labelledby={legendId}>
      <fieldset className="selector-fieldset">
        <legend id={legendId} className="selector-legend">
          <UsersRound size={18} aria-hidden="true" />
          Select patient profile
        </legend>

        <p className="selector-help">
          Choose a profile for this chat session, then confirm before starting your first message.
        </p>

        <div className="selector-list" role="radiogroup" aria-label="Showcase patient profiles">
          {visibleOptions.map((option) => {
            const optionId = `profile-${option.profileId}`;

            return (
              <label key={option.profileId} htmlFor={optionId} className="selector-option">
                <input
                  id={optionId}
                  type="radio"
                  name="showcase-profile"
                  value={option.profileId}
                  checked={pendingProfileId === option.profileId}
                  onChange={() => setPendingProfileId(option.profileId)}
                />
                <span className="selector-copy">
                  <span className="selector-label">{option.label}</span>
                  <span className="selector-summary">{option.summary}</span>
                </span>
              </label>
            );
          })}
        </div>

        {options.length > PROFILES_PER_PAGE && (
          <nav className="selector-pagination" aria-label="Patient profile pages">
            <button
              type="button"
              className="selector-page-button"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((page) => page - 1)}
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Previous
            </button>
            <span className="selector-page-status" aria-live="polite">
              Page {currentPage + 1} of {pageCount} · {options.length} profiles
            </span>
            <button
              type="button"
              className="selector-page-button"
              disabled={currentPage === pageCount - 1}
              onClick={() => setCurrentPage((page) => page + 1)}
            >
              Next
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </nav>
        )}

        <div className="selector-actions">
          <button
            type="button"
            className="selector-confirm"
            disabled={isConfirmDisabled}
            onClick={confirmSelection}
          >
            <Check size={17} aria-hidden="true" />
            Confirm Selection
          </button>
          <p className="selector-status" aria-live="polite">
            {confirmedProfileId
              ? `Selected for this session: ${confirmedProfileId}`
              : "No profile confirmed yet."}
          </p>
        </div>
      </fieldset>
    </section>
  );
}