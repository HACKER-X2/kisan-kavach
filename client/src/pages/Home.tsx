import FloodMap from "@/components/FloodMap";
import SmsPhone from "@/components/SmsPhone";
import SpectralComparison from "@/components/SpectralComparison";
import { calculateLiveFloodAssessment } from "@/components/liveFloodAssessment";
import { selectInitialSpectralPlotId } from "@/components/spectralModel";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Activity, Banknote, Check, ChevronRight, CloudRain, Download, FileJson2, Filter, Grid2X2, Landmark, Loader2, MapPinned, Radio, RefreshCcw, ShieldCheck, TimerReset, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AssessedPlot } from "../../../server/gisAnalytics";

type DistrictKey = "dhubri" | "darbhanga";
type RasterMode = "pre" | "post";

const portalLinks = ["PMFBY", "Bhuvan", "DILRMP", "DigiLocker"];
const districtNames: Record<DistrictKey, string> = { dhubri: "Dhubri", darbhanga: "Darbhanga" };
const stateForDistrict: Record<DistrictKey, string> = { dhubri: "Assam", darbhanga: "Bihar" };
const bboxByDistrict: Record<DistrictKey, [number, number, number, number]> = {
  dhubri: [89.956, 26.014, 89.976, 26.019],
  darbhanga: [85.886, 26.146, 85.897, 26.150],
};

function formatClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatIst(now: Date) {
  return {
    time: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now),
    date: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(now),
  };
}

function formatHectares(value: number) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(value);
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function Home() {
  const utils = trpc.useUtils();
  const [district, setDistrict] = useState<DistrictKey>("dhubri");
  const dashboardInput = useMemo(() => ({ district }), [district]);
  const dashboard = trpc.dashboard.stats.useQuery(dashboardInput, { refetchInterval: 30_000 });
  const weather = trpc.weather.precipitation.useQuery(dashboardInput, { enabled: Boolean(dashboard.data) && !dashboard.isFetching, refetchInterval: 10 * 60_000, retry: 1 });
  const activeFloodGeoJson = dashboard.data?.floodGeoJson ?? null;
  const processFlood = trpc.geo.processFlood.useMutation();
  const matchCadastral = trpc.claims.matchCadastral.useMutation();
  const sendIntimation = trpc.sms.sendIntimation.useMutation();
  const smsWebhook = trpc.sms.webhook.useMutation();
  const settlePfms = trpc.claims.settlePfms.useMutation();
  const resetDemo = trpc.demo.reset.useMutation();
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [engineMessage, setEngineMessage] = useState("Analytical GIS fixture loaded · select a Khasra parcel to inspect its calculation.");
  const [jsonPreview, setJsonPreview] = useState<string | null>(null);
  const [pfmsSettlement, setPfmsSettlement] = useState<AssessedPlot["settlement"] | null>(null);
  const [rasterMode, setRasterMode] = useState<RasterMode>("post");
  const [registryFilter, setRegistryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedPlotId(null);
    setRegistryFilter("");
    setStatusFilter("all");
  }, [district]);

  const plots = dashboard.data?.plots ?? [];
  useEffect(() => {
    if (!selectedPlotId && plots[0]) setSelectedPlotId(selectInitialSpectralPlotId(plots));
  }, [plots, selectedPlotId]);

  const selectedPlot = useMemo(() => plots.find((plot) => plot.id === selectedPlotId) ?? null, [plots, selectedPlotId]);
  const selectedAssessment = useMemo(() => calculateLiveFloodAssessment(selectedPlot, activeFloodGeoJson), [activeFloodGeoJson, selectedPlot]);
  const liveAssessments = useMemo(() => new Map(plots.map((plot) => [plot.id, calculateLiveFloodAssessment(plot, activeFloodGeoJson)])), [activeFloodGeoJson, plots]);
  const filteredPlots = useMemo(() => {
    const search = registryFilter.trim().toLowerCase();
    return plots.filter((plot) => {
      const matchesSearch = !search || [plot.ulpin, plot.khasraNo, plot.farmerName, plot.crop, plot.maskedAadhaar, plot.claimId].some((value) => value.toLowerCase().includes(search));
      const matchesStatus = statusFilter === "all" || plot.claimStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [plots, registryFilter, statusFilter]);
  const busy = processFlood.isPending || matchCadastral.isPending || smsWebhook.isPending || sendIntimation.isPending || settlePfms.isPending || resetDemo.isPending;
  const ist = formatIst(now);

  const choosePlot = (plot: AssessedPlot) => {
    const liveAssessment = calculateLiveFloodAssessment(plot, activeFloodGeoJson);
    setSelectedPlotId(plot.id);
    setEngineMessage(liveAssessment
      ? `Khasra #${plot.khasraNo}: ${liveAssessment.trueInundatedHa.toFixed(3)} ha capped inundation · ${liveAssessment.lossPercentage}% live Turf loss.`
      : `Khasra #${plot.khasraNo}: active flood geometry unavailable.`);
  };

  const refreshDashboard = async () => {
    await utils.dashboard.stats.invalidate({ district });
  };

  const resetForJudges = async () => {
    try {
      const result = await resetDemo.mutateAsync({ claimId: selectedPlot?.claimId });
      setPfmsSettlement(null);
      setJsonPreview(null);
      await refreshDashboard();
      setEngineMessage(result.message);
      toast.success("Judge demo reset", { description: `Fresh 72-hour window opened until ${new Date(result.deadlineAt).toLocaleString("en-IN")}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The judge demo could not be reset.";
      setEngineMessage(message);
      toast.error("Demo reset failed", { description: message });
    }
  };

  const runProcessor = async () => {
    try {
      const result = await processFlood.mutateAsync({ bbox: bboxByDistrict[district], district });
      setEngineMessage(`${result.jobId} verified · ${result.processor.result}`);
      toast.success("SAR flood layer verified", { description: "The active district fixture has been processed with the configured threshold rule." });
      await refreshDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The SAR processor could not complete.";
      setEngineMessage(message);
      toast.error("SAR processing failed", { description: message });
    }
  };

  const runMatching = async () => {
    try {
      const result = await matchCadastral.mutateAsync({ district });
      await refreshDashboard();
      setEngineMessage(`${result.autoClaimsTriggered} eligible plot(s) refreshed · all loss values use capped polygon intersection.`);
      toast.success("Cadastral matching refreshed", { description: "Flood loss values were re-derived from the active GeoJSON layer." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Spatial matching could not complete.";
      setEngineMessage(message);
      toast.error("Spatial matching failed", { description: message });
    }
  };

  const handleReply = async (reply: string, channel: "SMS" | "IVR_USSD") => {
    if (!selectedPlot) return;
    try {
      const result = await smsWebhook.mutateAsync({ claimId: selectedPlot.claimId, reply, channel });
      setSelectedPlotId(result.claim.id);
      await refreshDashboard();
      setEngineMessage(result.event);
      toast.success("Consent received", { description: "The simulator updated the selected claim state." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMS consent could not be processed.";
      setEngineMessage(message);
      toast.error("SMS processing failed", { description: message });
    }
  };

  const resend = async () => {
    if (!selectedPlot) return;
    try {
      const result = await sendIntimation.mutateAsync({ claimId: selectedPlot.claimId });
      await refreshDashboard();
      setEngineMessage(`SMS intimation reset for Khasra #${result.claim.khasraNo}.`);
      toast.success("SMS intimation reset");
    } catch (error) {
      toast.error("SMS dispatch failed", { description: error instanceof Error ? error.message : "Could not reset the SMS." });
    }
  };

  const disburseViaPfms = async (plot: AssessedPlot) => {
    try {
      const result = await settlePfms.mutateAsync({ claimId: plot.claimId });
      setPfmsSettlement(result.settlement);
      await refreshDashboard();
      setEngineMessage(`PFMS / NPCI APB settlement simulated for Khasra #${plot.khasraNo}.`);
      toast.success("DBT settlement simulated", { description: `UTR ${result.settlement.utr}` });
    } catch (error) {
      toast.error("Settlement not available", { description: error instanceof Error ? error.message : "Claim must be sealed before settlement." });
    }
  };

  const showJson = async (plot: AssessedPlot) => {
    try {
      setJsonPreview(JSON.stringify(await utils.claims.exportNcip.fetch({ claimId: plot.claimId }), null, 2));
    } catch (error) {
      toast.error("Claim payload unavailable", { description: error instanceof Error ? error.message : "Export failed" });
    }
  };

  const downloadDossier = async (plot: AssessedPlot) => {
    try {
      const response = await fetch(`/api/v1/claims/export-annexure-iv/${plot.claimId}`);
      if (!response.ok) throw new Error("PDF dossier generation failed");
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${plot.claimId}-PMFBY-Dossier.pdf`;
      anchor.click();
      URL.revokeObjectURL(href);
      toast.success("PDF dossier downloaded");
    } catch (error) {
      toast.error("PDF dossier unavailable", { description: error instanceof Error ? error.message : "Download failed" });
    }
  };

  if (dashboard.isError) return <DashboardState title="Command data unavailable" detail="The selected flood assessment fixture could not be loaded." action="Retry dashboard" onAction={() => dashboard.refetch()} />;
  if (dashboard.isLoading) return <DashboardState title="Loading KISAN KAVACH" detail="Loading flood geometry, cadastral parcels, and the PMFBY claim workflow." loading />;
  if (!dashboard.data || !plots.length) return <DashboardState title="No active flood records" detail="The selected jurisdiction does not contain active parcel records." action="Reload data" onAction={() => dashboard.refetch()} />;

  const { kpis, jurisdiction, center, floodGeoJson, sourceNotice, provenance } = dashboard.data;
  const weatherData = weather.data;
  const activeSla = selectedPlot?.sla ?? plots[0]?.sla;
  const elapsedSinceDashboard = Math.max(0, Math.floor((now.getTime() - new Date(dashboard.data.generatedAt).getTime()) / 1000));
  const slaSecondsRemaining = Math.max(0, (activeSla?.remainingSeconds ?? 0) - elapsedSinceDashboard);
  const slaHoursRemaining = Math.ceil(slaSecondsRemaining / 3600);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#102a43]">
      <header className="bg-[#0b2135] text-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-5 px-5 py-3 sm:px-9">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-sm border border-white/25 bg-white/10 text-lg font-serif">भारत</span><div><p className="text-xs font-semibold tracking-[.12em] text-[#a9d3f3]">भारत सरकार · GOVERNMENT OF INDIA</p><p className="mt-1 text-xs text-slate-300">Ministry of Agriculture &amp; Farmers Welfare · National Informatics Centre</p></div></div>
          <nav aria-label="Government services" className="hidden items-center gap-5 text-xs font-semibold text-slate-300 lg:flex">{portalLinks.map((link) => <a key={link} href="#registry" className="transition hover:text-white">{link}</a>)}</nav>
        </div>
        <div className="border-y border-white/15"><div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-5 px-5 py-5 sm:px-9 lg:flex-row lg:items-center"><div><h1 className="text-[27px] font-bold tracking-tight sm:text-[34px]">KISAN KAVACH <span className="mx-2 font-normal text-slate-500">·</span><span className="text-[#a9d3f3]">किसान कवच</span></h1><p className="mt-1 text-xs font-semibold tracking-[.12em] text-slate-300">MOA&amp;FW / PMFBY · FLOOD ASSESSMENT &amp; CLAIM COMMAND</p></div><div className="flex items-center gap-5"><div className="rounded-sm border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200"><span className="status-dot mr-2" />GIS SESSION ACTIVE</div><div className="text-right"><p className="font-mono text-xl font-bold tabular-nums">{ist.time} IST</p><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{ist.date}</p></div></div></div></div>
        <div className="bg-[#183b5d]"><div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-3 sm:px-9 lg:flex-row lg:items-center"><span className="mr-1 flex items-center gap-2 text-xs font-semibold text-slate-300"><MapPinned size={16} /> Jurisdiction</span><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">State</span><select aria-label="State" className="gov-select" value={stateForDistrict[district]} onChange={(event) => setDistrict(event.target.value === "Bihar" ? "darbhanga" : "dhubri")}><option>Assam</option><option>Bihar</option></select><ChevronRight className="hidden text-slate-500 lg:block" size={16} /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">District</span><select aria-label="District" className="gov-select" value={district} onChange={(event) => setDistrict(event.target.value as DistrictKey)}><option value="dhubri">Dhubri</option><option value="darbhanga">Darbhanga</option></select><ChevronRight className="hidden text-slate-500 lg:block" size={16} /><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Block</span><span className="inline-flex min-w-[132px] items-center rounded border border-[#b9c8d6] bg-white px-3 py-2 text-sm font-semibold text-[#102a43]">{jurisdiction.block}</span><span className="ml-auto hidden font-mono text-[10px] text-slate-300 xl:block">EPSG:4326 · Sentinel-1 IW GRD · 10 m</span></div></div>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-6 sm:px-9">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[#c9dce9] bg-[#eef7fd] px-4 py-3"><div className="flex items-center gap-2 text-sm text-[#36566f]"><Activity className="shrink-0 text-[#1e9b52]" size={17} />{engineMessage}</div><div className="flex flex-wrap gap-2"><button className="gov-button" onClick={resetForJudges} disabled={busy}><TimerReset size={14} /> Reset Judge Demo</button><button className="gov-button" onClick={runProcessor} disabled={busy}><RefreshCcw size={14} /> Verify SAR</button><button className="gov-button gov-button-primary" onClick={runMatching} disabled={busy}><Landmark size={14} /> Match Parcels</button></div></div>

        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Inundated Area" value={formatHectares(kpis.floodedAreaHa)} unit="ha" detail={`${kpis.averageLossPercentage}% mean loss across intersected parcels`} color="blue" icon={ShieldCheck} />
          <KpiCard label="Impacted Khasra Plots" value={String(kpis.impactedKhasraPlots)} unit="plots" detail={`${districtNames[district]} · ${jurisdiction.block} block`} color="purple" icon={Grid2X2} />
          <KpiCard label="Aadhaar-Seeded Claims" value={String(kpis.aadhaarSeededClaims)} unit="eligible" detail="Masked attributes in privacy-safe fixture" color="green" icon={Check} />
          <KpiCard label="72h Rainfall" value={weatherData ? `${weatherData.cumulative72hMm}` : "—"} unit="mm" detail={weatherData?.extremeFloodTrigger ? "STATUTORY EXTREME FLOOD TRIGGER: CONFIRMED" : weatherData?.source === "unavailable" ? "Open-Meteo currently unavailable" : "Open-Meteo precipitation · latest 72h"} color="blue" icon={CloudRain} />
          <KpiCard label="72h PMFBY SLA" value={activeSla?.status === "AUTO_SEALED_VIA_SATELLITE_TELEMETRY" ? "SEALED" : formatClock(slaSecondsRemaining)} unit="" detail={activeSla?.status === "AUTO_SEALED_VIA_SATELLITE_TELEMETRY" ? "Auto-Sealed via Satellite Telemetry (Rule 14.2 Escalation)" : `SLA Active: ${slaHoursRemaining} hours remaining · SAR ${new Date(activeSla?.sarAcquisitionAt ?? "").toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`} color="red" icon={Radio} urgent={slaSecondsRemaining > 0 && slaSecondsRemaining < 24 * 60 * 60} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.42fr)_minmax(350px,.88fr)]">
          <section className="gov-card"><header className="flex flex-col justify-between gap-4 border-b border-[#e2e8f0] p-5 md:flex-row md:items-center"><div className="flex gap-3"><span className="grid h-9 w-9 place-items-center rounded-sm bg-[#0b2135] text-white"><MapPinned size={18} /></span><div><p className="gov-label">GIS Cadastral Workspace</p><h2 className="mt-1 text-xl font-bold text-[#102a43]">Flood Overlay + Parcel Intersection</h2></div></div><div className="flex flex-wrap gap-2" aria-label="Map controls"><button className={cn("map-mode-button", rasterMode === "pre" && "map-mode-button-active") } onClick={() => setRasterMode("pre")}>Pre-Flood NDVI</button><button className={cn("map-mode-button", rasterMode === "post" && "map-mode-button-active") } onClick={() => setRasterMode("post")}>Post-Flood SAR</button></div></header><div className="min-h-[504px] bg-[#e9f2e5] p-3"><FloodMap floodGeoJson={floodGeoJson} plots={plots} selectedPlotId={selectedPlot?.id} onSelectPlot={choosePlot} center={center} district={jurisdiction.district} activeLayer={rasterMode} /></div><div className="grid border-t border-[#e2e8f0] text-sm sm:grid-cols-3"><MiniMetric label="Active product" value={rasterMode === "pre" ? "NDVI baseline · 18 Jul" : "SAR flood mask · 06 Aug"} /><MiniMetric label="Spatial reference" value="EPSG:4326 / WGS 84" /><MiniMetric label="Map centre" value={`${center.latitude.toFixed(4)}° N · ${center.longitude.toFixed(4)}° E`} /></div><p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-[10px] leading-4 text-amber-900"><strong>Fixture notice:</strong> {sourceNotice}</p></section>
          <SmsPhone plot={selectedPlot} assessment={selectedAssessment} busy={busy} onReply={handleReply} onResend={resend} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.42fr)_minmax(350px,.88fr)]">
          <SpectralComparison plot={selectedPlot} floodGeoJson={floodGeoJson} assessment={selectedAssessment} />
          <section className="gov-card overflow-hidden"><SectionHeading icon={ShieldCheck} eyebrow="Selected Khasra Plot" title="Intersection Assessment" />{selectedPlot ? <div className="p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xl font-bold text-[#102a43]">#{selectedPlot.khasraNo}</p><p className="mt-1 text-sm text-slate-500">{selectedPlot.village}, {selectedPlot.district}</p></div><StatusPill status={selectedPlot.claimStatus} /></div><dl className="grid grid-cols-2 gap-4 border-y border-[#e2e8f0] py-4 text-sm"><Meta label="ULPIN-style identifier" value={selectedPlot.ulpin} /><Meta label="Patta type" value={selectedPlot.pattaType} /><Meta label="Crop" value={selectedPlot.crop} /><Meta label="Indicative payout" value={formatInr(selectedPlot.estimatedPayoutInr)} /><Meta label="Turf parcel area" value={selectedAssessment ? `${selectedAssessment.parcelTotalHa.toFixed(3)} ha` : "—"} /><Meta label="Capped inundation" value={selectedAssessment ? `${selectedAssessment.trueInundatedHa.toFixed(3)} ha` : "—"} /><Meta label="Live loss percentage" value={selectedAssessment ? `${selectedAssessment.lossPercentage}%` : "—"} /><Meta label="Scale of Finance" value={`${formatInr(selectedPlot.scaleOfFinance.amountPerHa)} / ha`} /><Meta label="72h SLA" value={`SLA Active: ${slaHoursRemaining} hours remaining`} /><Meta label="SAR acquisition" value={new Date(selectedPlot.sla.sarAcquisitionAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST"} /><Meta label="Consent channel" value={selectedPlot.consentChannel.replaceAll("_", " ")} /><Meta label="Telemetry escalation" value={selectedPlot.autoSealedAt ? `Rule 14.2 · ${new Date(selectedPlot.autoSealedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` : "Not escalated"} /><Meta label="PFMS simulator" value={selectedPlot.settlement.status === "DIRECT_BENEFIT_TRANSFER_SUCCESSFUL" ? `DBT success · ${selectedPlot.settlement.utr}` : "Not initiated"} /></dl><div className="mt-4 rounded-sm border border-[#c9dce9] bg-[#f5faff] p-3 text-[10px] leading-4 text-[#36566f]"><p className="font-bold uppercase tracking-wide text-[#163a59]">Public-source evidence</p><p className="mt-1">Bhuvan: public reference portal · Copernicus scene: {provenance.copernicus.sceneId}</p><p className="mt-1 break-all font-mono">Local flood fixture SHA-256: {provenance.evidence.localFloodFixtureSha256}</p><p className="mt-1 text-amber-800">{provenance.evidence.checksumStatus}</p></div><p className="mt-3 text-[10px] leading-4 text-amber-800"><strong>Registry status:</strong> {selectedPlot.sourceRegistry}. Payout is indicative and awaits state-notification verification.</p><button onClick={() => showJson(selectedPlot)} className="gov-button gov-button-primary mt-4 w-full"><FileJson2 size={14} /> View claim JSON payload</button></div> : <div className="p-5 text-sm text-slate-500">Select a Khasra parcel on the map.</div>}</section>
        </div>

        <WeatherPanel weather={weatherData} district={districtNames[district]} />

        <section id="registry" className="gov-card mt-5 overflow-hidden"><div className="flex flex-col justify-between gap-4 border-b border-[#e2e8f0] p-5 lg:flex-row lg:items-center"><div><p className="gov-label">PMFBY Claim Registry · {jurisdiction.district} · {jurisdiction.block}</p><h2 className="mt-1 text-xl font-bold text-[#102a43]">Auto-Triggered Claim Assessments</h2></div><div className="flex flex-wrap gap-2"><button className="gov-button" onClick={() => selectedPlot && downloadDossier(selectedPlot)} disabled={!selectedPlot}><Download size={14} /> Download Annexure-IV PDF</button><button className="gov-button gov-button-primary" onClick={runMatching} disabled={busy}><TimerReset size={14} /> Refresh calculations</button></div></div><div className="flex flex-col gap-3 border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-3 md:flex-row md:items-center"><div className="relative flex-1"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} /><input value={registryFilter} onChange={(event) => setRegistryFilter(event.target.value)} placeholder="Filter by ULPIN, Khasra, farmer, crop, Aadhaar mask, or claim ID" className="w-full rounded-sm border border-[#cbd5e1] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2b73b6] focus:ring-2 focus:ring-[#2b73b6]/20" /></div><select aria-label="Filter claim status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="gov-select min-w-[190px]"><option value="all">All claim statuses</option><option value="INTIMATION_GENERATED">Intimation generated</option><option value="PENDING_CONSENT">Pending consent</option><option value="SEALED_FOR_PMFBY">Sealed for PMFBY</option><option value="DECLINED">Declined</option></select></div><div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-left"><thead className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">ULPIN / Khasra</th><th className="px-5 py-4">Farmer record</th><th className="px-5 py-4">Crop</th><th className="px-5 py-4">Total area</th><th className="px-5 py-4">Inundated area</th><th className="px-5 py-4">Damage</th><th className="px-5 py-4">Estimated payout</th><th className="px-5 py-4">72h intimation</th><th className="px-5 py-4">Actions</th></tr></thead><tbody>{filteredPlots.map((plot) => {
          const assessment = liveAssessments.get(plot.id);
          return <tr key={plot.id} onClick={() => choosePlot(plot)} className={cn("border-b border-[#e2e8f0] text-sm transition hover:bg-[#f5faff]", selectedPlot?.id === plot.id && "bg-[#eef7fd]")}><td className="px-5 py-4"><p className="font-mono text-[10px] font-semibold text-[#163a59]">{plot.ulpin}</p><p className="mt-1 font-semibold">#{plot.khasraNo}</p></td><td className="px-5 py-4 font-semibold">{plot.farmerName}</td><td className="px-5 py-4">{plot.crop}</td><td className="px-5 py-4 font-mono">{assessment?.parcelTotalHa.toFixed(3) ?? "0.000"} ha</td><td className="px-5 py-4 font-mono">{assessment?.trueInundatedHa.toFixed(3) ?? "0.000"} ha</td><td className="px-5 py-4"><span className="font-bold text-[#bd3e34]">{assessment?.lossPercentage ?? 0}%</span></td><td className="px-5 py-4"><p className="font-semibold text-[#1e7650]">{formatInr(plot.estimatedPayoutInr)}</p><p className="mt-1 text-[9px] text-slate-500">{plot.payoutEligibility === "meets_20_percent_threshold" ? "Threshold met" : "Below threshold"}</p></td><td className="px-5 py-4"><StatusPill status={plot.claimStatus} /><p className="mt-1 max-w-[180px] text-[9px] leading-3 text-slate-500">{plot.sla.displayLabel}</p></td><td className="px-5 py-4"><div className="flex gap-2"><button onClick={(event) => { event.stopPropagation(); showJson(plot); }} className="table-action">JSON</button><button onClick={(event) => { event.stopPropagation(); downloadDossier(plot); }} className="table-action">PDF</button>{(plot.claimStatus === "SEALED_FOR_PMFBY" || plot.claimStatus === "AUTO_SEALED_VIA_SATELLITE_TELEMETRY") && <button onClick={(event) => { event.stopPropagation(); disburseViaPfms(plot); }} className="table-action">PFMS</button>}</div></td></tr>;
        })}{filteredPlots.length === 0 && <tr><td colSpan={9} className="px-5 py-9 text-center text-sm text-slate-500">No claim assessments match the active filters.</td></tr>}</tbody></table></div></section>
      </main>
      {pfmsSettlement && <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b2135]/55 p-4" onClick={() => setPfmsSettlement(null)}><section className="w-full max-w-lg overflow-hidden rounded-md bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="border-b border-emerald-200 bg-emerald-50 px-6 py-5"><p className="gov-label text-emerald-700">PFMS / NPCI APB simulator</p><h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-emerald-900"><Check size={20} /> DIRECT BENEFIT TRANSFER SUCCESSFUL</h2></div><div className="space-y-4 p-6 text-sm"><Meta label="Transaction UTR" value={pfmsSettlement.utr ?? "—"} /><Meta label="Target account" value={pfmsSettlement.targetAccount} /><Meta label="Settlement timestamp" value={pfmsSettlement.settledAt ? new Date(pfmsSettlement.settledAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"} /><p className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{pfmsSettlement.notice}</p><button onClick={() => setPfmsSettlement(null)} className="gov-button gov-button-primary w-full">Close settlement record</button></div></section></div>}
      {jsonPreview && <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b2135]/55 p-4" onClick={() => setJsonPreview(null)}><section className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-md bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4"><div><p className="gov-label">PMFBY Claim Simulator</p><h2 className="text-lg font-bold">Structured JSON Payload</h2></div><button onClick={() => setJsonPreview(null)} className="rounded p-2 text-slate-500 hover:bg-slate-100" aria-label="Close JSON payload"><X size={18} /></button></div><pre className="max-h-[65vh] overflow-auto bg-[#f8fafc] p-5 text-xs leading-5 text-[#163a59]">{jsonPreview}</pre></section></div>}
    </div>
  );
}

function SectionHeading({ icon: Icon, eyebrow, title }: { icon?: typeof MapPinned; eyebrow: string; title: string }) { return <header className="flex items-start gap-3 border-b border-[#e2e8f0] p-5">{Icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-[#0b2135] text-white"><Icon size={18} /></span>}<div><p className="gov-label">{eyebrow}</p><h2 className="mt-1 text-xl font-bold text-[#102a43]">{title}</h2></div></header>; }
function KpiCard({ label, value, unit, detail, icon: Icon, color, urgent }: { label: string; value: string; unit: string; detail: string; icon: typeof ShieldCheck; color: "blue" | "purple" | "green" | "red"; urgent?: boolean }) { const colors = { blue: "border-l-[#2878b8] text-[#2878b8]", purple: "border-l-[#7c3aed] text-[#7c3aed]", green: "border-l-[#21824c] text-[#21824c]", red: "border-l-[#bd3e34] text-[#bd3e34]" }; return <section className={cn("gov-card min-h-[208px] border-l-4 p-5", colors[color])}><div className="flex items-start justify-between gap-3"><p className="gov-label max-w-[210px] leading-5">{label}</p><span className={cn("grid h-10 w-10 place-items-center rounded-sm bg-slate-50", colors[color])}><Icon size={20} /></span></div><div className="mt-5 flex items-end gap-2"><span className={cn("font-mono text-[36px] font-semibold leading-none tracking-tight", colors[color])}>{value}</span>{unit && <span className="mb-0.5 text-base text-[#3a4d60]">{unit}</span>}</div><p className={cn("mt-5 text-xs leading-5", color === "red" ? "text-[#bd3e34]" : "text-slate-500")}>{urgent && <span className="mr-2 rounded-sm bg-[#fde8e7] px-1.5 py-1 text-[9px] font-bold text-[#bd3e34]">URGENT</span>}{detail}</p></section>; }
type WeatherPanelData = {
  source: "open-meteo-archive" | "open-meteo-forecast" | "unavailable";
  sourceLabel: string;
  daily: Array<{ date: string; precipitationMm: number }>;
  peakEvent: { date: string; precipitationMm: number } | null;
  cumulative72hMm: number;
  extremeFloodTrigger: boolean;
  sourceUrl: string;
  fallbackReason?: string;
};
function WeatherPanel({ weather, district }: { weather: WeatherPanelData | undefined; district: string }) {
  const maximum = Math.max(1, ...(weather?.daily.map((item) => item.precipitationMm) ?? []));
  return <section className="gov-card mt-5 overflow-hidden"><div className="flex flex-col justify-between gap-3 border-b border-[#e2e8f0] p-5 md:flex-row md:items-center"><div><p className="gov-label">Live meteorological context · {district}</p><h2 className="mt-1 text-xl font-bold text-[#102a43]">Seven-day precipitation signal</h2></div>{weather && <div className={cn("rounded-sm border px-3 py-2 text-[10px] font-bold", weather.extremeFloodTrigger ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700")}>{weather.extremeFloodTrigger ? "STATUTORY EXTREME FLOOD TRIGGER: CONFIRMED" : "PRECIPITATION MONITORING ACTIVE"}</div>}</div>{weather?.daily.length ? <div className="p-5"><div className="flex h-40 items-end gap-2 border-b border-[#dbe7f0] pb-5">{weather.daily.map((item) => <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="font-mono text-[10px] font-semibold text-[#163a59]">{item.precipitationMm.toFixed(1)}</span><div className="w-full rounded-t-sm bg-[#2b73b6]" style={{ height: `${Math.max(5, (item.precipitationMm / maximum) * 105)}px` }} title={`${item.date}: ${item.precipitationMm} mm`} /><span className="font-mono text-[9px] text-slate-500">{item.date.slice(5)}</span></div>)}</div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><Meta label="Peak event" value={weather.peakEvent ? `${weather.peakEvent.precipitationMm.toFixed(1)} mm · ${weather.peakEvent.date}` : "—"} /><Meta label="Latest 72h" value={`${weather.cumulative72hMm.toFixed(1)} mm`} /><Meta label="Source mode" value={weather.source === "open-meteo-archive" ? "Archive response" : "Forecast fallback"} /></div><p className="mt-4 text-[10px] leading-4 text-slate-500">{weather.sourceLabel} · <a href={weather.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#1261a0] underline">View request</a>{weather.fallbackReason ? ` · Archive fallback: ${weather.fallbackReason}` : ""}</p></div> : <div className="p-5 text-sm text-slate-500">Weather ingestion is temporarily unavailable. The flood assessment continues to use the active GeoJSON and Turf intersection only.</div>}</section>;
}
function StatusPill({ status }: { status: string }) { const style = status === "SEALED_FOR_PMFBY" ? "border-green-200 bg-green-50 text-green-700" : status === "AUTO_SEALED_VIA_SATELLITE_TELEMETRY" ? "border-blue-200 bg-blue-50 text-blue-700" : status === "PENDING_CONSENT" || status === "INTIMATION_GENERATED" ? "border-amber-200 bg-amber-50 text-amber-700" : status === "DECLINED" ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"; return <span className={cn("rounded-sm border px-2 py-1 font-mono text-[10px] font-semibold", style)}>{status.replaceAll("_", " ")}</span>; }
function Meta({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-[#163a59]">{value}</dd></div>; }
function MiniMetric({ label, value }: { label: string; value: string }) { return <div className="border-b border-[#e2e8f0] px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="gov-label text-[9px]">{label}</p><p className="mt-1 font-mono text-xs text-[#163a59]">{value}</p></div>; }
function DashboardState({ title, detail, action, onAction, loading }: { title: string; detail: string; action?: string; onAction?: () => void; loading?: boolean }) { return <div className="grid min-h-screen place-items-center bg-[#f8fafc] p-5"><section className="gov-card max-w-md p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#e8f3fb] text-[#1261a0]">{loading ? <Loader2 className="animate-spin" size={20} /> : <CloudRain size={20} />}</div><h1 className="mt-4 text-xl font-bold text-[#102a43]">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>{action && <button onClick={onAction} className="gov-button gov-button-primary mt-5">{action}</button>}</section></div>; }
