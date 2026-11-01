# WMS Integration Validation

## Validation result

| Reference | Result | Production implication |
|---|---|---|
| ISRO Bhuvan Disaster WMS — `https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms` | The supplied `GetCapabilities` request reached the host but did not return an inspectable public service document in this environment. No service layer, acquisition date, or CORS behaviour was verified. | Treat as a provenance reference only; do not label the application as actively rendering Bhuvan WMS until a valid capabilities document and permitted layer request are verified. |
| Copernicus CDSE supplied URL — `https://shervices.dataspace.copernicus.eu/ogc/wms/` | A direct `curl` GetCapabilities probe failed DNS resolution (`Could not resolve host`). | Do not use this hostname. |
| Copernicus CDSE documented WMS | Official documentation specifies `https://sh.dataspace.copernicus.eu/ogc/wms/<INSTANCE_ID>`. It states that a registered custom instance ID is required to access WMS layers. | A configured CDSE instance ID is required before the app can render date-specific Sentinel WMS layers. |
| Esri World Imagery | Public tile service is reachable in the existing comparison panel. | Use only as a high-resolution terrain basemap with its required attribution; it is not a dated Sentinel scene or flood adjudication product. |

## Source links

- Copernicus Data Space Ecosystem WMS documentation: <https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/OGC/WMS.html>
- Copernicus Data Space Ecosystem OGC API overview: <https://dataspace.copernicus.eu/ogc-api>
- ISRO Bhuvan reference endpoint: <https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms>
- Esri World Imagery: <https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer>

> The UI must distinguish live data products from references. Source URLs and catalog identifiers are audit metadata until an authorized WMS instance and reproducible `GetCapabilities` / `GetMap` responses are connected.
