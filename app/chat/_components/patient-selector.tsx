"use client";

import { useEffect, useId, useState } from "react";
import type { ShowcasePatientOption } from "@/lib/showcase/patient-options";

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
  const legendId = useId();
  const isConfirmDisabled = pendingProfileId.length === 0 || pendingProfileId === confirmedProfileId;

  useEffect(() => {
    if (!confirmedProfileId) {
      if (options.length > 0) {
        setPendingProfileId((current) => (current.length > 0 ? current : options[0].profileId));
      }
      return;
    }

    setPendingProfileId(confirmedProfileId);
  }, [confirmedProfileId, options]);

  return (
    <section className="selector-shell" aria-labelledby={legendId}>
      <fieldset className="selector-fieldset">
        <legend id={legendId} className="selector-legend">
          Select patient profile
        </legend>

        <p className="selector-help">
          Choose a profile for this chat session, then confirm before starting your first message.
        </p>

        <div className="selector-list" role="radiogroup" aria-label="Showcase patient profiles">
          {options.map((option) => {
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

        <div className="selector-actions">
          <button
            type="button"
            className="selector-confirm"
            disabled={isConfirmDisabled}
            onClick={() => onConfirmSelection(pendingProfileId)}
          >
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