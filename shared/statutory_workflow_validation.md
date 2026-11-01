# Statutory Workflow Validation

On 18 August 2026 (IST), the rebuilt Dhubri dashboard displayed an active statutory countdown of `47:25:48`, with the explicit header and selected-parcel label **“SLA Active: 48 hours remaining.”** The displayed acquisition basis was `2026-08-16T19:38:00Z`, rendered as `17/08/2026, 01:08 IST`, and the selected Khasra #413/1 consent panel remained synchronized with the same deadline.

The current assessment was above the 24-hour urgency threshold, so the normal SMS wording correctly remained visible. Automated urgent reminder behavior is covered by regression tests for the under-24-hour condition, including the formatted indicative payout.

The selected claim’s **Download Annexure-IV PDF** action completed successfully in the live preview. Regression coverage verifies the dossier includes SAR acquisition, SMS dispatch, confirmation-or-escalation, the statutory deadline, and the clearly labelled representative IMD/ERA5 reference telemetry of `148.5 mm` for the 72-hour assessment window.
