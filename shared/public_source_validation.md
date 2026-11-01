# Public Source Validation Notes

## Open-Meteo historical precipitation

The zero-credential Open-Meteo archive endpoint was directly queried for the Dhubri dashboard coordinate and the requested 10–17 August 2026 period. It returned a daily `time`, `precipitation_sum`, and `rain_sum` series in millimetres with the `Asia/Kolkata` timezone. The application may use this response for live weather visualisation, but must label it **Open-Meteo meteorological data** rather than an IMD statutory observation.

## ISRO Bhuvan Disaster Services

The public flood portal at `https://bhuvan-app1.nrsc.gov.in/disaster/disaster.php?id=flood` was directly verified as reachable. It exposes the National Remote Sensing Centre / Bhuvan Disaster Services interface and a WMS Manager, but it does not itself establish that the dashboard’s local representative flood GeoJSON is an official Bhuvan operational product. The dashboard must cite this page as a **public reference portal** and retain the local-layer provenance notice.

## PMFBY Scale of Finance

The public `https://www.data.gov.in/keywords/pmfby` catalog page was directly verified as reachable, but it did not expose a directly usable state-and-crop Scale-of-Finance resource identifier in the page content. The requested crop rates will therefore be represented in the application as **configuration values supplied for the demonstrator**, with an explicit renewal requirement against the relevant State Level Co-ordination Committee on Crop Insurance / state notification before any production claim calculation.

## Verification date

The source checks above were performed on 17 August 2026 (IST).

## Unified upgrade live-preview verification

On 18 August 2026 (IST), the rebuilt Dhubri dashboard successfully displayed a server-side Open-Meteo precipitation response with **7.9 mm** for the latest 72-hour total. The preview also showed the seven-day rainfall interface, Esri World Imagery in the spectral comparison, the active Turf vector overlay, ULPIN-style representative identifiers, indicative payout values, and the `INTIMATION_GENERATED` workflow state. The selected Khasra #413/1 remained synchronized at **0.368 ha of 1.889 ha (19.5%)** from the shared Turf intersection. These observations do not convert demonstrator GeoJSON or representative identities into authoritative government records.

The representative SMS simulator was also tested with reply `1`; it displayed the consent confirmation and moved the selected record to `SEALED_FOR_PMFBY`. This state is a local demonstration workflow, not a submission to NCIP or an insurer.
