# 🌾 KISAN KAVACH
### Geospatial Intelligence for Agricultural Flood Assessment and Farmer-Centric Insurance Workflows

<p align="center">
  <strong>Turning flood data into actionable agricultural intelligence.</strong>
</p>

<p align="center">
  GIS-Based Flood Assessment | Parcel-Level Impact Analysis | Insurance Workflow Automation
</p>

---

## 📌 Introduction

Agricultural communities are among the most vulnerable to extreme weather events, particularly floods. When agricultural land gets inundated, farmers may face significant crop losses. However, identifying affected farmland, assessing the extent of inundation, and coordinating insurance-related documentation can be a complex and time-consuming process.

**KISAN KAVACH** is a GIS-driven agricultural flood assessment platform designed to streamline this process through geospatial analysis, parcel-level impact estimation, and structured insurance claim workflows.

The platform combines geographical data processing, cadastral parcel mapping, flood inundation analysis, and indicative financial assessment to provide a unified view of agricultural flood impact.

Instead of treating an entire district as one affected region, KISAN KAVACH focuses on individual agricultural parcels (Khasras), calculating how much of each parcel intersects with a flood-affected geographical area.

The resulting information can support more structured assessment, prioritization, and documentation of agricultural flood impact.

## 🎯 Problem Statement

Agricultural flood assessment often involves several disconnected activities:

- Identifying flood-affected geographical regions.
- Determining which agricultural parcels overlap with inundated areas.
- Estimating the extent of inundation for individual parcels.
- Assessing indicative financial impact using crop-specific rates.
- Communicating claim-related information to farmers.
- Managing consent, documentation, and claim processing timelines.

KISAN KAVACH aims to bring these activities together in a unified geospatial workflow.

## 💡 Our Solution

KISAN KAVACH introduces a parcel-centric approach to agricultural flood assessment.

The platform follows a structured workflow:

1. **Flood Area Identification:** Uses representative flood geometry and associated metadata to demonstrate flood assessment workflows.
2. **Cadastral Intersection:** Intersects flood-affected geometry with agricultural parcel boundaries.
3. **Parcel-Level Impact Calculation:** Calculates inundated area and percentage for individual agricultural plots.
4. **Indicative Financial Assessment:** Estimates potential financial impact using configured crop-specific financial rates.
5. **Farmer Intimation:** Demonstrates SMS-based communication and consent collection.
6. **Claim Documentation:** Generates structured claim-related data and PDF documentation.
7. **Workflow Monitoring:** Demonstrates SLA tracking and simulated settlement workflows.

## ✨ Key Features

### 1. Geospatial Flood Assessment
- Interactive geographical visualization.
- Flood polygon and agricultural parcel overlays.
- District-level geographical exploration.
- Representative flood assessment metadata.

### 2. Parcel-Level Cadastral Analysis
- Intersection of flood geometry and cadastral parcel geometry.
- Calculation of total parcel area.
- Calculation of inundated parcel area.
- Inundation percentage estimation.
- Identification of affected agricultural plots.

### 3. Indicative Financial Assessment
- Crop-specific configured financial rates.
- Parcel-level indicative payout calculations.
- Impact severity categorization.
- Configurable inundation threshold.

### 4. Farmer Communication and Consent
- SMS intimation workflow demonstration.
- Farmer response handling.
- Consent status tracking.
- Claim workflow progression.

### 5. Claim Documentation
- Claim-related JSON exports.
- PDF dossier generation.
- Structured claim information.
- Demonstration of an insurance-oriented documentation workflow.

### 6. Operational Monitoring
- Dashboard statistics.
- Flood assessment summaries.
- Claim status monitoring.
- SLA countdown and workflow tracking.
- Simulated settlement references.

## 🏗️ System Architecture

KISAN KAVACH follows a modular client-server architecture.

```text
                  USER
                   |
                   v
          React Frontend Application
                   |
          TanStack Query + tRPC
                   |
                   v
            Express Backend
                   |
        +----------+-----------+
        |          |           |
        v          v           v
     GIS Engine  Claim       Weather
     (Turf.js)   Workflow    Service
        |          |           |
        v          v           v
   GeoJSON      Consent     Weather Data
   Processing   Management  Integration
        |
        v
  Parcel Intersection
        |
        v
  Inundation Analysis
        |
        v
 Indicative Financial
     Assessment
        |
        v
  Claim Documentation
        |
        v
  PDF / JSON Exports

                   |
                   v
           Drizzle ORM
                   |
                   v
              MySQL
```

### Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| UI Components | Radix UI, shadcn-style components |
| Mapping | Leaflet, React-Leaflet |
| Geospatial Processing | Turf.js |
| Data Visualization | Recharts |
| API Communication | tRPC, TanStack Query |
| Backend | Node.js, Express |
| Database | MySQL |
| ORM | Drizzle ORM |
| Validation | Zod |
| PDF Generation | PDFKit |
| Testing | Vitest |
| Package Manager | pnpm |

## 🧮 Geospatial Calculation Methodology

One of the central components of KISAN KAVACH is its parcel-level inundation calculation.

For an agricultural parcel:

- Let `A(p)` represent the total geographical area of the parcel.
- Let `F` represent the flood-affected geographical area.
- Let `A(p ∩ F)` represent the area of intersection between the parcel and flood geometry.

The inundated area is:

```text
Inundated Area = Area(Parcel ∩ Flood Geometry)
```

The inundation percentage is:

```text
Inundation Percentage =
(Inundated Area / Total Parcel Area) × 100
```

The implementation uses Turf.js geospatial operations to calculate polygon areas and intersections.

### Indicative Financial Assessment

The configured financial assessment follows the general calculation:

```text
Indicative Financial Amount =
Inundated Area × Configured Crop Rate per Hectare
```

The result is an indicative estimate based on geographical inundation and configured rates. It is not a verified crop-loss assessment or an officially approved insurance payout.

## 📂 Project Structure

```text
kisan-kavach/
│
├── client/
│   ├── index.html
│   └── src/
│       ├── components/
│       │   └── ui/
│       ├── contexts/
│       ├── data/
│       ├── hooks/
│       ├── lib/
│       ├── pages/
│       ├── services/
│       ├── App.tsx
│       ├── const.ts
│       ├── index.css
│       └── main.tsx
│
├── server/
│   ├── _core/
│   ├── data/
│   ├── context.ts
│   ├── db.ts
│   ├── dossierPdf.ts
│   ├── gisAnalytics.ts
│   ├── operationalWorkflow.ts
│   ├── pmfbyPayout.ts
│   ├── restApi.ts
│   ├── routers.ts
│   └── weatherService.ts
│
├── shared/
│
├── drizzle/
│   └── schema.ts
│
├── patches/
│
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

*Note: The structure above highlights the primary application modules. Additional files and subdirectories are present in the repository.*

## ⚙️ Installation and Setup

Follow these steps to run KISAN KAVACH locally.

### Prerequisites

Install the following:

- Node.js (recommended: Node.js 22 LTS).
- pnpm package manager (version 10.4.1).
- GitHub repository cloned or downloaded to your local machine.
- MySQL (required when using the database-backed functionality).

### Step 1: Get the Project

Clone the repository:

```bash
git clone https://github.com/HACKER-X2/kisan-kavach.git
```

Navigate into the project directory:

```bash
cd kisan-kavach
```

### Step 2: Install Dependencies

```bash
npm install -g pnpm@10.4.1
```

Install the project dependencies:

```bash
pnpm install
```

### Step 3: Configure Environment Variables

Create a `.env` file in the project root.

Use `.env.example` as the reference for the required environment variables.

```env
DATABASE_URL=mysql://username:password@localhost:3306/kisan_kavach
```

Replace the database credentials with your local MySQL configuration.

Additional environment variables may be required for authentication, external integrations, and optional services. Configure them according to `.env.example` and the corresponding integration settings.

**Never commit your `.env` file, API keys, access tokens, or database passwords to GitHub.**

### Step 4: Database Setup

Create a MySQL database:

```sql
CREATE DATABASE kisan_kavach;
```

Run database migrations:

```bash
pnpm exec drizzle-kit migrate
```

Database-backed functionality requires a correctly configured `DATABASE_URL`.

### Step 5: Start the Development Server

Run:

```bash
pnpm dev
```

Open the local URL displayed in your terminal, typically:

```text
http://localhost:3000
```

The application attempts to use an available port if its default port is occupied.

### Windows Compatibility Note

The current development scripts use Unix-style environment variable assignment.

On Windows, if `pnpm dev` fails because of `NODE_ENV`, configure cross-env:

```bash
pnpm add -D cross-env
```

Update the scripts in `package.json`:

```json
{
  "dev": "cross-env NODE_ENV=development tsx watch server/_core/index.ts",
  "start": "cross-env NODE_ENV=production node dist/index.js"
}
```

Keep the other existing package scripts unchanged.

Then run:

```bash
pnpm dev
```

## 🧪 Testing and Production Build

### TypeScript Validation

```bash
pnpm check
```

### Run Tests

```bash
pnpm test
```

### Build the Application

```bash
pnpm build
```

### Start the Production Build

```bash
pnpm start
```

The production server uses the generated build output. Build the application before starting it.

## 🔌 External Integrations

The application contains integration points for external services, including:

- Open-Meteo weather data.
- Copernicus Data Space Ecosystem (CDSE) WMS integration.
- Esri World Imagery basemap.
- OAuth-based authentication.
- SMS and voice-related workflows.
- Storage and file handling integrations.

Some integrations require additional environment variables and external service credentials.

The application may use fallback or demonstration behavior when optional integrations are not configured.

## ⚠️ Data, Accuracy and Prototype Limitations

KISAN KAVACH is currently a functional prototype demonstrating a geospatial agricultural flood assessment and claim workflow.

The following distinctions are important:

- The currently implemented flood processing workflow uses representative GeoJSON fixtures and metadata. It does not demonstrate a complete operational Sentinel-1 SAR raster ingestion and pixel-classification pipeline.
- The cadastral and flood geometries are representative datasets, not authoritative government land records.
- Calculated inundation represents geographical overlap, not independently verified crop damage.
- Crop-specific financial rates are configured demonstration values and require verification against applicable official notifications.
- SMS/IVR communication and farmer consent workflows are demonstrations, not verified live government communication services.
- Claim exports are documentation demonstrations, not actual submissions to the National Crop Insurance Portal (NCIP).
- PFMS/NPCI settlement functionality is simulated and does not initiate real financial transfers.
- Some workflow state is maintained in application memory and is not fully persisted in MySQL.

These limitations are explicitly acknowledged to distinguish the demonstrated implementation from future production integrations.

## 🔐 Security Considerations

- Store credentials in environment variables.
- Never expose API keys or access tokens in frontend source code.
- Avoid uploading private farmer information or sensitive land records.
- Use appropriate authentication and authorization before production deployment.
- Validate external service inputs and protect database credentials.
- Apply appropriate privacy, consent, and data-retention controls before processing real farmer information.

## 🚀 Future Scope

Potential areas for further development include:

- Actual Sentinel-1 SAR raster ingestion and flood classification.
- Automated satellite-based flood detection.
- Integration with verified cadastral and administrative datasets.
- Production-grade farmer notification and consent infrastructure.
- Persistent claim workflow state and audit trails.
- Official insurance portal integration, subject to authorization.
- AI-assisted document interpretation and geospatial decision support.
- Multilingual farmer interaction.
- Improved crop damage verification and human-in-the-loop assessment.

## 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Implement your changes.
4. Test your implementation.
5. Submit a pull request with a clear description of the changes.

Please ensure that changes do not introduce exposed credentials or unverified claims about data accuracy.

## 📜 License

This project is distributed under the license specified in the repository's `LICENSE` file.

If no license has been added yet, the project should not be assumed to be open-source licensed until one is selected and committed.

## 👨‍💻 Project

**KISAN KAVACH**

Geospatial intelligence for agricultural flood assessment and farmer-centric insurance workflows.

Built with a focus on practical GIS engineering, transparent assessment, and accessible agricultural technology.
