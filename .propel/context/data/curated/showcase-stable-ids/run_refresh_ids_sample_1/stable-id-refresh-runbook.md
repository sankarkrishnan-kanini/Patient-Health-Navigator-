# Stable ID Refresh Runbook

- Run ID: run_refresh_ids_sample_1
- Completeness Run ID: run_local_completeness_sample
- Registry Path: .propel\context\data\curated\showcase-stable-ids\stable-id-registry.json
- Registry Backup Path: none

## Rollback Guidance
1. Stop downstream publication if change detection is unexpected.
2. Restore registry from backup file (if present).
3. Re-run refresh with corrected input cohort.

### PowerShell Restore Example
No backup file exists yet for this run.

## Safety Checks
- Verify mapping report added/removed/updated sections before promoting.
- Verify demo script lookup index resolves all expected stable IDs.
- Keep backup registry snapshot until validation sign-off is complete.
