# Project TODO

- [x] Establish a dark command-center visual system with technical typography, responsive sidebar navigation, and live status treatment.
- [x] Add mock Bihar and Assam flood districts, Sentinel-1 flood layers, and Khasra plot data.
- [x] Define database tables and seed data for flood events, Khasra plots, claims, SMS events, and legal consent tokens.
- [x] Implement a mock SAR processor that documents Otsu and -18 dB threshold logic and returns severity GeoJSON.
- [x] Implement cadastral flood-overlap matching and automatic claim triggering.
- [x] Implement the SMS consent state machine with the exact reply trigger "1" and SUBMITTED_NCIP completion state.
- [x] Implement PMFBY DigiClaim-compliant structured JSON export for individual claims.
- [x] Build command dashboard KPI cards and Bihar/Assam district summary table.
- [x] Build the interactive flood map with severity overlays and Khasra plot selection.
- [x] Build the dual-panel pre-flood and post-flood plot inspector with metadata drawer.
- [x] Build the interactive feature-phone SMS simulator and real-time claim pipeline.
- [x] Add frontend loading, empty, error, and action feedback states.
- [x] Add Vitest coverage for processing, matching, consent, and export procedures.
- [x] Verify desktop and mobile visuals, check types, and run the application test suite.
- [x] Replace precomputed cadastral percentages with dynamic GeoJSON flood-to-plot intersection calculations before triggering claims.
- [x] Add plot-linked mock pre-flood optical and post-flood SAR raster assets to the inspector.
- [x] Complete query failure, empty data, and mutation success/error feedback states across the dashboard.
- [x] Refine cadastral matching to derive overlap directly from the same mock GeoJSON flood features exposed by the SAR processing endpoint.

- [x] Replace the dark command-center theme with the official NIC / MoA&FW Government Portal visual system matching the supplied screenshot.
- [x] Add exact GoI header, KISAN KAVACH title block, portal links, jurisdiction selector, and four screenshot-matched KPI cards with dynamic 72-hour countdown.
- [x] Replace broad mock flood data with structured Dhubri, Assam GeoJSON centered near 26.02 N, 89.97 E and realistic Khasra/flood polygon records.
- [x] Add Turf.js area/intersection calculation for flood-mask loss percentage.
- [x] Update PMFBY Claims Register with actual Khasra records and working Annexure-IV PDF and DigiClaim JSON actions.
- [x] Re-run tests, type checks, responsive screenshots, and save a new checkpoint for the redesign.

- [x] Add map hover tooltips for Khasra plot ID and calculated loss percentage.
- [x] Keep PMFBY consent regression tests deterministic within the simulated 72-hour claim window.
- [x] Prevent optional weather telemetry latency from blocking the initial KISAN KAVACH dashboard render.
- [x] Add a judge-friendly demo reset that restarts the 72-hour legal claim countdown and returns the selected claim to pending consent.
- [x] Reopen the selected claim as PENDING_CONSENT during judge-demo reset and verify the SMS panel reflects the active consent step.
