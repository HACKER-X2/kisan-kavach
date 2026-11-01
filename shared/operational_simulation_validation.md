# Operational Simulator Validation

## Live preview observation — 18 August 2026 (IST)

The dashboard displayed a PMFBY SLA card with a deadline-derived remaining duration and a flood-detection timestamp. The selected Dhubri representative plot displayed the same statutory window. The consent simulator switched from **2-Way SMS** to **IVR / USSD** and rendered Hindi and Assamese keypad-`1` confirmation copy for the selected 19.5% live Turf loss assessment.

All consent, escalation, and settlement interactions remain clearly labelled as representative simulation workflows. No live telecom, PFMS, NPCI, bank, or claim-submission endpoint is invoked.

## End-to-end simulator check — 18 August 2026 (IST)

The IVR/USSD keypad response `1` sealed representative claim `18010041310012` within the statutory window. The registry then exposed its **PFMS** action. The simulated settlement dialog displayed transaction UTR `PFMS2026INB88219401`, the masked PM-KISAN account, and the explicit non-production `DIRECT BENEFIT TRANSFER SUCCESSFUL` outcome.

## Restart check — 18 August 2026 (IST)

After a server restart, the dashboard recomputed the SLA card from the persisted flood-detection timestamp (`17 Aug 2026, 07:45 IST`) and rendered the remaining statutory duration. The selected representative Khasra record retained its ULPIN-style identifier, live 19.5% Turf loss, indicative payout, and consent workflow controls.

The rendered dashboard DOM contained the **Intersection Assessment** selected-plot inspector, the consent simulator, the statutory SLA card, the weather panel, and the claim registry as separate operational surfaces after the restart.

The selected representative claim was then confirmed again through the SMS keypad path. The UI reported `SEALED_FOR_PMFBY`, and the consent card displayed the statutory SLA outcome as sealed by farmer confirmation within the 72-hour window.

The selected-plot inspector exposed the sealed SLA outcome, SMS channel, no telemetry escalation, and a pending PFMS simulation state before settlement. Clicking the sealed row’s **PFMS** control then showed the explicit simulator dialog: `DIRECT BENEFIT TRANSFER SUCCESSFUL`, UTR `PFMS2026INB88219401`, masked PM-KISAN account, timestamp, and the non-production notice.

For an independent IVR/USSD verification after settlement, the browser was switched to the Darbhanga representative district to load a fresh, unsealed claim workflow.

On Khasra #118/7 (Darbhanga), the IVR / USSD tab rendered the Hindi and Assamese keypad prompt. Submitting keypad `1` produced the confirmation notice, set the claim pipeline to `SEALED_FOR_PMFBY`, and changed the statutory SLA presentation to farmer-confirmed within the window.

The sealed Darbhanga registry row then exposed the PFMS action. Its simulated settlement result displayed UTR `PFMS2026INB88219401`, a masked linked PM-KISAN account, and `DIRECT BENEFIT TRANSFER SUCCESSFUL`; the modal also stated that no real PFMS, NPCI, bank, or PM-KISAN account was contacted.

After closing the modal, the selected Khasra #118/7 inspector reported `CONSENT CHANNEL: IVR USSD`, `72H SLA: Sealed by farmer confirmation within the statutory window`, `TELEMETRY ESCALATION: Not escalated`, and `PFMS SIMULATOR: DBT success · PFMS2026INB88219401`. The successful live settlement mutation confirms that the earlier missing `settlePfmsClaim` console record was stale from an earlier hot-reload state; the restarted router currently imports and invokes the exported settlement function.

Regional IVR verification: on the restarted Dhubri dashboard, selecting `IVR / USSD` revealed the accessible `IVR voice language` selector with Hindi, Assamese, Marathi, and Bengali options. Dhubri defaulted to Assamese, and the rendered prompt included the live 19.5% loss value plus the keypad `1` confirmation instruction.
