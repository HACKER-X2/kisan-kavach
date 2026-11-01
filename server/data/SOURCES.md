# GIS Fixture Source Context

The GeoJSON files in this directory are **representative analytical fixtures**, not downloaded official parcel boundaries or claim adjudication products. They are positioned in the requested Dhubri and Darbhanga operating areas and use an attribute structure suitable for demonstrating a flood-assessment workflow without exposing personal information.

| Source | How it informs the application | URL |
|---|---|---|
| ISRO/NRSC Bhuvan Disaster Services | Provides the Government of India disaster-services context for flood-layer workflows and tools. | https://bhuvan-app1.nrsc.gov.in/disaster/disaster.php |
| DILRMP MIS | Provides the land-record modernization context for digitized cadastral maps and linked record workflows. | https://www.dilrmp.gov.in/ |
| Department of Land Resources, PIB year-end review | Documents DILRMP objectives, digitized cadastral-map progress, ULPIN/Bhu-Aadhaar context, and the use of geo-coordinates for parcels. | https://www.pib.gov.in/PressReleasePage.aspx?PRID=1989671 |

> Production use must replace these fixtures with licensed, authorized flood products and state revenue parcel services. The application labels all farmer records as fixtures, masks Aadhaar values, and marks dossier exports as non-adjudicatory demonstration artifacts.

## Terrain presentation basemap

The spectral comparison uses the Esri World Imagery tile service as a high-resolution terrain presentation layer: <https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer>. Sentinel-1 and Sentinel-2 dates, values, and loss metrics in the interface remain assessment-fixture metadata; the basemap does not represent an archived or adjudicated acquisition for those dates.
