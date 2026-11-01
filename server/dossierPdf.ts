import { getClaimExport } from "./gisAnalytics";

function cleanPdfText(value: string | number | null) {
  return String(value ?? "—").replace(/[()\\]/g, "").replace(/[^\x20-\x7E]/g, "");
}

function text(x: number, y: number, size: number, value: string | number | null, font = "F1", colour = "0.063 0.129 0.208") {
  return `BT /${font} ${size} Tf ${colour} rg ${x} ${y} Td (${cleanPdfText(value)}) Tj ET`;
}

function box(x: number, y: number, width: number, height: number, colour: string, stroke = false) {
  return `${colour} ${stroke ? "RG" : "rg"} ${x} ${y} ${width} ${height} re ${stroke ? "S" : "f"}`;
}

/** Builds a compact, printable PMFBY assessment dossier without external runtime dependencies. */
export function buildClaimDossierPdf(claimId: string): Buffer {
  const payload = getClaimExport(claimId);
  const { cadastral, assessment } = payload;
  const content = [
    box(0, 742, 612, 50, "0.043 0.129 0.208"),
    text(42, 770, 18, "KISAN KAVACH", "F2", "1 1 1"),
    text(42, 754, 8, "PMFBY FLOOD ASSESSMENT & CLAIM DOSSIER", "F1", "0.78 0.88 0.96"),
    text(404, 767, 8, `DOSSIER ${payload.applicationUuid}`, "F1", "0.82 0.9 0.96"),
    text(42, 724, 8, "REPRESENTATIVE ANALYTICAL GIS FIXTURE — NOT AN OFFICIAL NCIP FILING", "F1", "0.69 0.23 0.2"),
    box(42, 691, 528, 20, "0.925 0.957 0.98"),
    text(52, 698, 9, "1. CLAIM REGISTRY & CADASTRAL IDENTIFICATION", "F1", "0.063 0.129 0.208"),
    text(52, 670, 8, "Claim ID", "F1", "0.38 0.45 0.52"),
    text(52, 656, 10, payload.applicationUuid, "F2"),
    text(230, 670, 8, "Claim status", "F1", "0.38 0.45 0.52"),
    text(230, 656, 10, payload.claimStatus, "F2"),
    text(410, 670, 8, "ULPIN-style identifier", "F1", "0.38 0.45 0.52"),
    text(410, 656, 9, cadastral.ulpin, "F2"),
    text(52, 628, 8, "Khasra number", "F1", "0.38 0.45 0.52"),
    text(52, 614, 10, cadastral.khasraNo, "F2"),
    text(230, 628, 8, "Land registry area", "F1", "0.38 0.45 0.52"),
    text(230, 614, 10, `${cadastral.totalAreaHa.toFixed(3)} ha`, "F2"),
    text(410, 628, 8, "Masked Aadhaar", "F1", "0.38 0.45 0.52"),
    text(410, 614, 10, cadastral.maskedAadhaar, "F2"),
    text(52, 586, 8, "Jurisdiction", "F1", "0.38 0.45 0.52"),
    text(52, 572, 10, `${cadastral.village}, ${cadastral.block}`, "F2"),
    text(330, 572, 10, `${cadastral.district}, ${cadastral.state} · ${assessment.crop}`, "F2"),
    box(42, 535, 528, 20, "0.925 0.957 0.98"),
    text(52, 542, 9, "2. GEO-SPATIAL FLOOD ASSESSMENT", "F1", "0.063 0.129 0.208"),
    text(52, 514, 8, "Satellite source", "F1", "0.38 0.45 0.52"),
    text(52, 500, 10, assessment.satelliteSource, "F2"),
    text(230, 514, 8, "Computed loss", "F1", "0.38 0.45 0.52"),
    text(230, 500, 16, `${assessment.lossPercentage}%`, "F2", "0.74 0.24 0.2"),
    text(410, 514, 8, "Severity", "F1", "0.38 0.45 0.52"),
    text(410, 500, 10, assessment.severity.toUpperCase(), "F2"),
    text(52, 472, 8, "Raw polygon intersection", "F1", "0.38 0.45 0.52"),
    text(52, 458, 10, `${assessment.intersectedAreaHa.toFixed(3)} ha`, "F2"),
    text(230, 472, 8, "Capped inundated area", "F1", "0.38 0.45 0.52"),
    text(230, 458, 10, `${assessment.trueInundatedHa.toFixed(3)} ha`, "F2"),
    text(410, 472, 8, "Indicative payout", "F1", "0.38 0.45 0.52"),
    text(410, 458, 10, `INR ${payload.financialAssessment.indicativePayoutInr.toLocaleString("en-IN")}`, "F2", "0.11 0.45 0.28"),
    box(42, 402, 528, 35, "0.985 0.95 0.89"),
    text(52, 423, 8, "AREA SAFETY & FINANCIAL STATUS", "F2", "0.56 0.28 0.05"),
    text(52, 409, 9, "trueInundatedHa = min(area(Flood Mask intersection Parcel), registry total area).", "F1", "0.35 0.24 0.09"),
    text(52, 389, 8, `Indicative rate: INR ${payload.financialAssessment.scaleOfFinancePerHa.toLocaleString("en-IN")} / ha · ${payload.financialAssessment.sourceStatus}.`, "F1", "0.35 0.24 0.09"),
    box(42, 344, 528, 20, "0.925 0.957 0.98"),
    text(52, 351, 9, "3. CONSENT & AUDIT TRAIL", "F1", "0.063 0.129 0.208"),
    text(52, 323, 8, "Consent channel", "F1", "0.38 0.45 0.52"),
    text(52, 309, 10, payload.farmerConsent.channel, "F2"),
    text(230, 323, 8, "Consent timestamp", "F1", "0.38 0.45 0.52"),
    text(230, 309, 10, payload.farmerConsent.consentTimestamp ?? "Awaiting SMS reply", "F2"),
    text(410, 323, 8, "Policy reference", "F1", "0.38 0.45 0.52"),
    text(410, 309, 9, cadastral.pmfbyPolicyId, "F2"),
    text(52, 291, 7, `SAR acquisition: ${payload.statutoryAudit.sarAcquisitionTimestamp} · SMS dispatch: ${payload.statutoryAudit.smsDispatchTimestamp}`, "F1", "0.35 0.24 0.09"),
    text(52, 278, 7, `Confirmation / escalation: ${payload.statutoryAudit.confirmationTimestamp ?? payload.statutoryAudit.autoSealTimestamp ?? "Awaiting response"} · ${payload.operationalSla.displayLabel}`, "F1", "0.35 0.24 0.09"),
    text(52, 265, 7, `SLA deadline: ${payload.statutoryAudit.slaDeadlineTimestamp} · urgent reminder: ${payload.statutoryAudit.urgentReminderRequired ? "required" : "not required"}`, "F1", "0.35 0.24 0.09"),
    text(52, 252, 7, `IMD/ERA5 telemetry: ${payload.statutoryAudit.rainfallTelemetry.cumulative72hMm} mm · ${payload.statutoryAudit.rainfallTelemetry.period}`, "F1", "0.35 0.24 0.09"),
    text(52, 239, 7, `PFMS / NPCI APB simulator: ${payload.pfmsSettlement.status} · UTR ${payload.pfmsSettlement.utr ?? "not initiated"}`, "F1", "0.35 0.24 0.09"),
    box(42, 202, 528, 27, "0.96 0.97 0.98"),
    text(52, 219, 8, "METHOD & PUBLIC-SOURCE NOTE", "F2", "0.063 0.129 0.208"),
    text(52, 206, 7, `Sentinel-1 SAR geometry · Copernicus: ${assessment.provenance.copernicus.sceneId} · Bhuvan reference only`, "F1"),
    text(42, 187, 7, `Fixture SHA-256: ${assessment.provenance.evidence.localFloodFixtureSha256} · Generated: ${payload.createdAt}`, "F1", "0.38 0.45 0.52"),
    "0.886 0.91 0.94 RG 42 174 m 570 174 l S",
    text(42, 158, 7, "This downloadable dossier is a demonstrative PMFBY workflow artifact. It must not be used as a land record or claim adjudication decision.", "F1", "0.38 0.45 0.52"),
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(pdf, "utf8"); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
