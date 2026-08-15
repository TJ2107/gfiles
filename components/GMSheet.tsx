
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { GlobalFileRow } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, LabelList 
} from 'recharts';
import { ThreeDBarVertical, ThreeDBarHorizontal } from './ThreeDShapes';
import { 
  Camera, Calendar, 
  X, ListFilter, Activity, CheckCircle2, History, Layers, Timer,
  ArrowRight, Globe, Tag, MapPin, CheckSquare,
  FilePlus, Presentation, ChevronLeft, ChevronRight, Maximize2,
  TrendingUp, Award, FileText, Sparkles, Sliders,
  Zap, Thermometer, Wrench, AlertTriangle, Cpu
} from 'lucide-react';
import { downloadChartAsJpg } from '../utils/chartHelpers';
import { parseDate } from '../utils/dateHelpers';

interface GMSheetProps {
  data: GlobalFileRow[];
  onFilterChange: (column: string, value: string) => void;
  onSwitchToData: () => void;
}

const COLORS = {
  created: '#2563eb',
  closed: '#16a34a',
  backlog: '#9333ea',
  pending: '#d97706',
  internalProd: '#059669',
  tvx: '#64748b',
  spa: '#2563eb',
  atv: '#eab308',
  htc: '#ea580c'
};

const PENDING_X_COLORS: Record<string, string> = {
  "STHIC TRAVAUX EN COURS": COLORS.tvx,
  "STHIC SPA": COLORS.spa,
  "STHIC ATTENTE VALIDATION HTC": COLORS.atv,
  "HTC DIVERS": COLORS.htc
};

export const GMSheet: React.FC<GMSheetProps> = ({ data, onFilterChange, onSwitchToData }) => {
  const flowChartRef = useRef<HTMLDivElement>(null);
  const efficiencyChartRef = useRef<HTMLDivElement>(null);
  const pendingChartRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<'slides' | 'full'>('slides');
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [period, setPeriod] = useState<{start: string, end: string}>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return { start: formatDate(start), end: formatDate(end) };
  });

  // Auto-fit period to dataset range on load so stats are immediately visible
  useEffect(() => {
    if (data && data.length > 0) {
      let minDate: Date | null = null;
      let maxDate: Date | null = null;

      data.forEach(row => {
        const d = parseDate(row["Date de création du SWO"]) || parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
        if (d && !isNaN(d.getTime())) {
          if (!minDate || d < minDate) minDate = d;
          if (!maxDate || d > maxDate) maxDate = d;
        }
      });

      if (minDate && maxDate) {
        const formatDate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        setPeriod({ start: formatDate(minDate), end: formatDate(maxDate) });
      }
    }
  }, [data]);

  const [drillDownData, setDrillDownData] = useState<GlobalFileRow[] | null>(null);
  const [drillDownTitle, setDrillDownTitle] = useState("");

  const stats = useMemo(() => {
    let totalCreatedInPeriod = 0; 
    let totalClosedInPeriod = 0; 
    
    let createdAndClosedInPeriod = 0; 
    let backlogResolvedInPeriod = 0; 
    let remainingFromPeriod = 0;     
    
    const statusXCounts: Record<string, number> = { 
      "STHIC TRAVAUX EN COURS": 0, 
      "STHIC SPA": 0, 
      "STHIC ATTENTE VALIDATION HTC": 0, 
      "HTC DIVERS": 0 
    };
    const regionStockMap: Record<string, number> = {};
    
    const startDate = period.start ? new Date(period.start + 'T00:00:00') : null;
    const endDate = period.end ? new Date(period.end + 'T23:59:59.999') : null;
    
    data.forEach(row => {
      const creationDate = parseDate(row["Date de création du SWO"]);
      const closingDate = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
      
      const xStatus = String(row["X"] || row["x-Value"] || row["x_Value"] || row["X Status"] || row["State SWO"] || row["TAS Status"] || "");
      const region = String(row["Region"] || "INCONNUE").trim().toUpperCase();
      
      const isCreatedDuring = creationDate && startDate && endDate && creationDate >= startDate && creationDate <= endDate;
      const isClosedDuring = closingDate && startDate && endDate && closingDate >= startDate && closingDate <= endDate;
      const isCreatedBefore = creationDate && startDate && creationDate < startDate;
      const isNotClosedAtEnd = !closingDate || (endDate && closingDate > endDate);

      if (isCreatedDuring) totalCreatedInPeriod++;
      if (isClosedDuring) totalClosedInPeriod++;

      if (isCreatedDuring && isClosedDuring) {
        createdAndClosedInPeriod++;
      }
      
      if (isCreatedBefore && isClosedDuring) {
        backlogResolvedInPeriod++;
      }
      
      if (isCreatedDuring && isNotClosedAtEnd) {
        remainingFromPeriod++;
        
        if (xStatus.includes("TVX")) statusXCounts["STHIC TRAVAUX EN COURS"]++;
        else if (xStatus.includes("SPA")) statusXCounts["STHIC SPA"]++;
        else if (xStatus.includes("ATV") || xStatus.includes("VAL")) statusXCounts["STHIC ATTENTE VALIDATION HTC"]++;
        else if (xStatus.includes("HTC")) statusXCounts["HTC DIVERS"]++;
        
        regionStockMap[region] = (regionStockMap[region] || 0) + 1;
      }
    });

    const regionStats = Object.entries(regionStockMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const closureRatio = totalCreatedInPeriod > 0 ? Math.round((totalClosedInPeriod / totalCreatedInPeriod) * 100) : 0;
    const directResolutionRate = totalCreatedInPeriod > 0 ? Math.round((createdAndClosedInPeriod / totalCreatedInPeriod) * 100) : 0;

    return { 
      flowData: [
        { name: 'Total Créés', value: totalCreatedInPeriod, fill: COLORS.created }, 
        { name: 'Total Fermés', value: totalClosedInPeriod, fill: COLORS.closed }
      ], 
      efficiencyData: [
        { name: 'Créés & Clos Période', value: createdAndClosedInPeriod, fill: COLORS.internalProd }, 
        { name: 'Backlog Résolu', value: backlogResolvedInPeriod, fill: COLORS.backlog }, 
        { name: 'Stock Restant Période', value: remainingFromPeriod, fill: COLORS.pending }
      ], 
      pendingXData: Object.entries(statusXCounts).filter(([, val]) => val > 0).map(([key, val]) => ({ name: key, value: val })), 
      totals: { totalCreatedInPeriod, totalClosedInPeriod, createdAndClosedInPeriod, backlogResolvedInPeriod, remainingFromPeriod },
      closureRatio,
      directResolutionRate,
      regionStats
    };
  }, [data, period]);

  const KPICard = ({ title, value, icon: Icon, colorClass, subtitle, borderAccent }: { title: string; value: string | number; icon: React.ElementType; colorClass: string; subtitle?: string; borderAccent?: string }) => (
    <div className={`relative bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden group hover:shadow-lg transition-all duration-300 flex flex-col justify-between`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-xl bg-slate-50 text-slate-600 group-hover:scale-110 transition-transform ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <h4 className={`text-3xl sm:text-4xl font-black tracking-tight ${colorClass}`}>{value}</h4>
          {subtitle && <span className="text-xs font-semibold text-slate-400">{subtitle}</span>}
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${borderAccent || 'bg-slate-200'}`}></div>
    </div>
  );

  const handleDrillDown = (entry: { name: string }, chartType: string) => {
    if (!entry) return;
    const { name } = entry;
    const startDate = period.start ? new Date(period.start) : null;
    const endDate = period.end ? new Date(period.end) : null;
    if (startDate) startDate.setHours(0,0,0,0);
    if (endDate) endDate.setHours(23,59,59,999);

    const filtered = data.filter(row => {
      const creationDate = parseDate(row["Date de création du SWO"]);
      const closingDate = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
      
      const isCreatedDuring = creationDate && startDate && endDate && creationDate >= startDate && creationDate <= endDate;
      const isClosedDuring = closingDate && startDate && endDate && closingDate >= startDate && closingDate <= endDate;
      const isCreatedBefore = creationDate && startDate && creationDate < startDate;
      const isNotClosedAtEnd = !closingDate || (endDate && closingDate > endDate);

      if (chartType === 'FLOW') {
         if (name === 'Total Créés') return isCreatedDuring;
         if (name === 'Total Fermés') return isClosedDuring;
      }
      if (chartType === 'EFFICIENCY') {
         if (name === 'Créés & Clos Période') return isCreatedDuring && isClosedDuring;
         if (name === 'Backlog Résolu') return isCreatedBefore && isClosedDuring;
         if (name === 'Stock Restant Période') return isCreatedDuring && isNotClosedAtEnd;
      }
      return false;
    });
    setDrillDownData(filtered); 
    setDrillDownTitle(`${name}`);
  };

  const handleRegionDrillDown = (regionName: string) => {
    const startDate = period.start ? new Date(period.start) : null;
    const endDate = period.end ? new Date(period.end) : null;
    if (startDate) startDate.setHours(0,0,0,0);
    if (endDate) endDate.setHours(23,59,59,999);

    const filtered = data.filter(row => {
      const creationDate = parseDate(row["Date de création du SWO"]);
      const closingDate = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
      const region = String(row["Region"] || "INCONNUE").trim().toUpperCase();
      
      const isCreatedDuring = creationDate && startDate && endDate && creationDate >= startDate && creationDate <= endDate;
      const isNotClosedAtEnd = !closingDate || (endDate && closingDate > endDate);
      
      return region === regionName && isCreatedDuring && isNotClosedAtEnd;
    });

    setDrillDownData(filtered);
    setDrillDownTitle(`Stock Période : ${regionName}`);
  };

  const handleProblemCategoryDrillDown = (categoryTitle: string, rows: GlobalFileRow[]) => {
    setDrillDownData(rows);
    setDrillDownTitle(`Problématique : ${categoryTitle}`);
  };

  const topProblems = useMemo(() => {
    const categoriesDef = [
      {
        id: "energy",
        category: "Groupes Électrogènes (GE) & Générateurs Critiques",
        keywords: ["ge", "groupe", "generateur", "generator", "carburant", "dg", "fioul", "essence", "pompe", "alternateur", "demarreur", "vidange", "filtre ge", "fuel", "injection", "niveau fioul"],
        icon: Zap,
        badgeColor: "bg-red-600 text-white",
        badgeText: "RANG 1 • CRITIQUE",
        borderAccent: "border-red-200",
        problemBg: "bg-red-50/80 border-red-200 text-slate-800",
        solutionBg: "bg-emerald-50/80 border-emerald-200 text-slate-800",
        problem: "Anomalies et défaillances mécaniques/électriques sur les groupes électrogènes (non-démarrage automatique au basculement, pannes d'alternateur/démarreur, ruptures de niveau de carburant ou filtres bouchés) ayant menacé d'interrompre la continuité de service des sites.",
        solution: "Instaurer des tests mensuels de démarrage en charge (ATS/inverseur), effectuer les vidanges et remplacements préventifs de filtres GE à échéance fixe, et verrouiller le rechargement en carburant avant le seuil critique des 25%."
      },
      {
        id: "rectifiers",
        category: "Redresseurs, Cartes Contrôleurs & Breakers DC (Énergie Continue)",
        keywords: ["redresseur", "rectifier", "controleur", "controller", "carte", "breaker", "disjoncteur dc", "smps", "module", "command", "supervision", "rack", "busbar", "fuse", "fusible"],
        icon: Cpu,
        badgeColor: "bg-purple-600 text-white",
        badgeText: "RANG 2 • ÉLEVÉ",
        borderAccent: "border-purple-200",
        problemBg: "bg-purple-50/80 border-purple-200 text-slate-800",
        solutionBg: "bg-indigo-50/80 border-indigo-200 text-slate-800",
        problem: "Panne des cartes contrôleurs de baie d'énergie, dysfonctionnement des modules redresseurs et déclenchements intempestifs des breakers DC / départ batterie (défauts de régulation DC, cartes de commande grillées/HS, sous-tension/surtension du bus continu).",
        solution: "Remplacer en urgence les cartes contrôleurs défaillantes, réenclencher ou échanger les breakers DC calibrés, effectuer le swap direct des modules redresseurs HS et réétalonner la régulation de charge du bus continu."
      },
      {
        id: "env_alarms",
        category: "Alarmes Environnementales",
        keywords: ["alarme", "alarm", "environnemental", "env", "sonde", "temperature", "fumee", "intrusion", "inondation", "eau", "humidity", "smoke", "porte", "door", "feu", "fire", "pending"],
        icon: Thermometer,
        badgeColor: "bg-amber-600 text-white",
        badgeText: "RANG 4 • ÉLEVÉ",
        borderAccent: "border-amber-200",
        problemBg: "bg-amber-50/80 border-amber-200 text-slate-800",
        solutionBg: "bg-blue-50/80 border-blue-200 text-slate-800",
        problem: "Persistance d'alarmes environnementales non acquittées ou restées en 'Pending' (température excessive, fumée, intrusion, humidité ou inondation), risquant de masquer des incidents critiques et d'entraîner des pannes matérielles non signalées.",
        solution: "Apurer immédiatement l'historique des alarmes environnementales en suspens lors des tournées PM, auditer le bon fonctionnement des capteurs et sondes, et mettre en place une supervision active des remontées d'alarmes."
      },
      {
        id: "grid_issues",
        category: "Baisse de Tension, Coupures Grid, Inverseurs & Batteries Backup (Leoch)",
        keywords: ["grid", "secteur", "breaker grid", "disjoncteur grid", "baisse", "tension", "sous-tension", "surtension", "phase", "inverseur", "ats", "eneo", "edf", "ge sur grid", "ge tourne", "delestage", "batterie", "battery", "backup", "leoch", "autonomie"],
        icon: Activity,
        badgeColor: "bg-orange-600 text-white",
        badgeText: "RANG 3 • SÉVÈRE",
        borderAccent: "border-orange-200",
        problemBg: "bg-orange-50/80 border-orange-200 text-slate-800",
        solutionBg: "bg-teal-50/80 border-teal-200 text-slate-800",
        problem: "Chutes de tension sévères sur le réseau Grid, coupures répétées, défaillance de bascule d'inverseur (GE tournant malgré la présence du secteur), insuffisance d'autonomie des batteries de backup et nécessité de remplacement des batteries défectueuses de marque Leoch.",
        solution: "Recalibrer les seuils ATS, auditer les bobines d'inverseur, planifier le remplacement immédiat des batteries Leoch en fin de vie par des blocs backup neufs et dimensionner l'autonomie requise face aux baisses de tension récurrentes."
      },
      {
        id: "pm_process",
        category: "Maintenance Préventive (PM) & Process de Clôture",
        keywords: ["pm", "maintenance", "visite", "entretien", "recette", "conformite", "preventive", "inspection", "replanifie", "pv", "rapport", "dossier"],
        icon: Wrench,
        badgeColor: "bg-indigo-600 text-white",
        badgeText: "RANG 5 • OPÉRATIONNEL",
        borderAccent: "border-indigo-200",
        problemBg: "bg-indigo-50/80 border-indigo-200 text-slate-800",
        solutionBg: "bg-emerald-50/80 border-emerald-200 text-slate-800",
        problem: "Accumulation de retards d'exécution des visites préventives (PM) et goulets d'étranglement administratifs lors des validations de PV de recette/HTC ralentissant les clôtures.",
        solution: "Digitaliser la signature des PV de recette sur l'application mobile des techniciens FE, réorganiser les plannings de tournée par secteur et accélérer la validation client."
      }
    ];

    const startDate = period.start ? new Date(period.start + 'T00:00:00') : null;
    const endDate = period.end ? new Date(period.end + 'T23:59:59.999') : null;

    // Strict filter for the selected month/period (created within period)
    const targetRows = data.filter(row => {
      const creationDate = parseDate(row["Date de création du SWO"]);

      if (startDate && endDate) {
        return creationDate && creationDate >= startDate && creationDate <= endDate;
      }
      return true;
    });

    const categoryMap: Record<string, GlobalFileRow[]> = {
      other: []
    };
    categoriesDef.forEach(c => {
      categoryMap[c.id] = [];
    });

    targetRows.forEach(row => {
      const desc = (
        String(row["Description"] || "") + " " + 
        String(row["Short description"] || "") + " " + 
        String(row["Comments Reco"] || "") + " " + 
        String(row["Commentaire"] || "")
      ).toLowerCase();

      let matched = false;
      for (const catDef of categoriesDef) {
        if (catDef.keywords.some(kw => desc.includes(kw))) {
          categoryMap[catDef.id].push(row);
          matched = true;
          break;
        }
      }
      if (!matched) {
        categoryMap.other.push(row);
      }
    });

    const totalAnalyzed = targetRows.length;
    const denominator = totalAnalyzed > 0 ? totalAnalyzed : 1;

    const list = categoriesDef.map(catDef => {
      const matchedRows = categoryMap[catDef.id] || [];
      const count = matchedRows.length;
      const percentage = totalAnalyzed > 0 ? Math.round((count / denominator) * 100) : 0;
      return {
        ...catDef,
        count,
        percentage,
        matchedRows
      };
    });

    list.sort((a, b) => b.count - a.count);

    return {
      totalAnalyzed,
      topCategories: list,
      otherCount: categoryMap.other.length
    };
  }, [data, period]);

  const successRoomStats = useMemo(() => {
    const startDate = period.start ? new Date(period.start + 'T00:00:00') : null;
    const endDate = period.end ? new Date(period.end + 'T23:59:59.999') : null;

    const closedRows = data.filter(row => {
      const closingDate = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
      if (startDate && endDate && closingDate) {
        return closingDate >= startDate && closingDate <= endDate;
      }
      return false;
    });

    const capexKeywords = [
      "groupe", "ge", "generateur", "generator", "carburant", "dg", 
      "hybride", "hybridation", "batterie", "battery", "backup", "leoch", 
      "remplacement", "changement", "moteur", "alternateur", "solaire", "pv", 
      "inverter", "inverseur", "redresseur", "rectifier", "capex"
    ];

    const geKeywords = ["groupe", "ge", "generateur", "generator", "carburant", "dg", "moteur", "alternateur"];
    const hybridKeywords = ["hybride", "hybridation", "solaire", "pv"];
    const batteryKeywords = ["batterie", "battery", "backup", "leoch", "remplacement", "changement"];

    const geRows: GlobalFileRow[] = [];
    const hybridRows: GlobalFileRow[] = [];
    const batteryRows: GlobalFileRow[] = [];
    const otherCapexRows: GlobalFileRow[] = [];
    const allCapexRows: GlobalFileRow[] = [];

    closedRows.forEach(row => {
      const desc = (
        String(row["Description"] || "") + " " + 
        String(row["Short description"] || "") + " " + 
        String(row["Comments Reco"] || "") + " " + 
        String(row["Commentaire"] || "")
      ).toLowerCase();

      const isCapex = capexKeywords.some(kw => desc.includes(kw));
      if (isCapex) {
        allCapexRows.push(row);
        if (geKeywords.some(kw => desc.includes(kw))) {
          geRows.push(row);
        } else if (hybridKeywords.some(kw => desc.includes(kw))) {
          hybridRows.push(row);
        } else if (batteryKeywords.some(kw => desc.includes(kw))) {
          batteryRows.push(row);
        } else {
          otherCapexRows.push(row);
        }
      }
    });

    const totalClosed = closedRows.length;
    const totalCapex = allCapexRows.length;
    const capexRatio = totalClosed > 0 ? Math.round((totalCapex / totalClosed) * 100) : 0;

    return {
      totalClosed,
      totalCapex,
      capexRatio,
      geRows,
      hybridRows,
      batteryRows,
      otherCapexRows,
      allCapexRows
    };
  }, [data, period]);

  const slideTitles = [
    { id: 1, name: "Diapositive 1 : Performance Globale" },
    { id: 2, name: "Diapositive 2 : SWO Entrants/Sortants & Efficacité Opérationnelle" },
    { id: 3, name: "Diapositive 3 : Analyse des SWO Période" },
    { id: 4, name: "Diapositive 4 : Top 5 Problématiques Critiques & Solutions" },
    { id: 5, name: "Diapositive 5 : Success Room Activité (SWO CAPEX Clos)" }
  ];

  return (
    <div className={`p-4 sm:p-8 space-y-6 bg-white min-h-full ${isFullscreen ? 'fixed inset-0 z-[999] overflow-y-auto bg-slate-900 text-white p-6 sm:p-12' : ''}`}>
      
      {/* PPT Presentation Control Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border-2 border-slate-200/90 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
            <Presentation className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 font-black text-[10px] uppercase tracking-wider rounded-md border border-indigo-200">
                Rapport Présentation PPT
              </span>
              <span className="text-xs text-slate-500 font-extrabold uppercase">Feuille GM Performance</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase mt-0.5">
              Revue de Performance Opérationnelle
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border-2 border-slate-200 text-xs shadow-2xs">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <input 
              type="date" 
              className="border-none bg-transparent font-black outline-none cursor-pointer text-slate-900" 
              value={period.start} 
              onChange={(e) => setPeriod(prev => ({ ...prev, start: e.target.value }))} 
            />
            <span className="text-slate-400 font-black">à</span>
            <input 
              type="date" 
              className="border-none bg-transparent font-black text-indigo-700 outline-none cursor-pointer" 
              value={period.end} 
              onChange={(e) => setPeriod(prev => ({ ...prev, end: e.target.value }))} 
            />
          </div>

          {/* View Mode Switches */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('slides')}
              className={`px-3.5 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 ${
                viewMode === 'slides' 
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Presentation className="w-3.5 h-3.5" />
              <span>Diapositives PPT</span>
            </button>
            <button
              onClick={() => setViewMode('full')}
              className={`px-3.5 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 ${
                viewMode === 'full' 
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Vue Complète</span>
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-all border border-slate-200"
            title={isFullscreen ? "Quitter le plein écran" : "Mode Plein Écran Présentation"}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Slide Navigator Controls (Only active in 'slides' mode) */}
      {viewMode === 'slides' && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-xl border-2 border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Navigation Slides :</span>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => setCurrentSlide(num)}
                  className={`px-3.5 py-1 rounded-lg text-xs font-black transition-all ${
                    currentSlide === num 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs font-black text-slate-900 uppercase tracking-tight">
            {slideTitles.find(s => s.id === currentSlide)?.name}
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentSlide === 1}
              onClick={() => setCurrentSlide(prev => Math.max(1, prev - 1))}
              className="p-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-black text-slate-700">
              {currentSlide} / 5
            </span>
            <button
              disabled={currentSlide === 5}
              onClick={() => setCurrentSlide(prev => Math.min(5, prev + 1))}
              className="p-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      {(viewMode === 'full' || currentSlide === 1) && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm space-y-6 relative overflow-hidden">
          {/* PPT Slide Banner */}
          <div className="flex justify-between items-start border-b-2 border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                  SLIDE 01
                </span>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Synthèse Exécutive</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                Performance Globale
              </h3>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-slate-500 text-xs font-bold">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Feuille GM Comité Direction</span>
            </div>
          </div>

          {/* Key Executive Insights Callouts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border-2 border-blue-200/80 shadow-2xs flex items-start gap-3.5">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shrink-0 shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-900">Taux de Clôture Globale</p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.closureRatio}%</p>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">Ratio SWO fermés rapporté aux SWO créés sur la période.</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border-2 border-emerald-200/80 shadow-2xs flex items-start gap-3.5">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0 shadow-xs">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Résolution Directe (Internal Prod)</p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.directResolutionRate}%</p>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">SWO créés ET entièrement clos sur le même mois.</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border-2 border-purple-200/80 shadow-2xs flex items-start gap-3.5">
              <div className="p-2.5 bg-purple-600 text-white rounded-xl shrink-0 shadow-xs">
                <History className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-purple-900">Rattrapage du Backlog</p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.totals.backlogResolvedInPeriod} SWO</p>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">Anciens SWO antérieurs résolus durant cette période.</p>
              </div>
            </div>
          </div>

          {/* Main KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard title="SWO Créés (Entrants)" value={stats.totals.totalCreatedInPeriod} icon={FilePlus} colorClass="text-blue-600" subtitle="Entrants" borderAccent="bg-blue-600" />
            <KPICard title="Créés & Clos Période" value={stats.totals.createdAndClosedInPeriod} icon={CheckSquare} colorClass="text-emerald-600" subtitle="Internal Prod" borderAccent="bg-emerald-600" />
            <KPICard title="Backlog Résolu" value={stats.totals.backlogResolvedInPeriod} icon={History} colorClass="text-purple-600" subtitle="Anciens clos" borderAccent="bg-purple-600" />
            <KPICard title="Stock Période Restant" value={stats.totals.remainingFromPeriod} icon={Layers} colorClass="text-amber-600" subtitle="En suspens" borderAccent="bg-amber-600" />
            <KPICard title="Total Fermés (Output)" value={stats.totals.totalClosedInPeriod} icon={CheckCircle2} colorClass="text-indigo-600" subtitle="Sorties" borderAccent="bg-indigo-600" />
          </div>

          {/* Executive Commentary Box */}
          <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl border-2 border-indigo-500/40 shadow-md space-y-3">
            <div className="flex items-center gap-2.5 border-b border-indigo-500/30 pb-3">
              <div className="p-2 bg-indigo-600 rounded-xl">
                <Sparkles className="w-5 h-5 text-indigo-200" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-indigo-200">
                  Synthèse d'Interprétation Opérationnelle
                </h4>
                <p className="text-xs text-slate-300 font-medium">
                  Analyse consolidée de l'activité du {period.start || 'début'} au {period.end || 'fin'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                <p className="font-black text-indigo-300 uppercase text-[11px]">1. Équilibre des Flux</p>
                <p className="text-slate-200 leading-relaxed">
                  <span className="font-extrabold text-white">{stats.totals.totalCreatedInPeriod} SWO</span> créés face à <span className="font-extrabold text-white">{stats.totals.totalClosedInPeriod} SWO</span> fermés (taux d'absorption global de <span className="font-bold text-emerald-400">{stats.closureRatio}%</span>). {stats.totals.totalClosedInPeriod >= stats.totals.totalCreatedInPeriod ? 'L\'équipe parvient à réduire la charge globale.' : 'Le rythme des entrées exige un suivi renforcé des fermetures.'}
                </p>
              </div>

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                <p className="font-black text-emerald-300 uppercase text-[11px]">2. Efficacité Directe</p>
                <p className="text-slate-200 leading-relaxed">
                  <span className="font-extrabold text-white">{stats.totals.createdAndClosedInPeriod} SWO</span> (<span className="font-bold text-emerald-400">{stats.directResolutionRate}%</span> des créations) ont été traités et fermés sur le mois même de leur ouverture.
                </p>
              </div>

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1">
                <p className="font-black text-purple-300 uppercase text-[11px]">3. Traitement du Backlog</p>
                <p className="text-slate-200 leading-relaxed">
                  Résorption de <span className="font-extrabold text-white">{stats.totals.backlogResolvedInPeriod} anciens SWO</span> hors période. Le stock d'en-cours créé sur la période s'établit à <span className="font-bold text-amber-400">{stats.totals.remainingFromPeriod} SWO</span>.
                </p>
              </div>
            </div>
          </div>

          {/* Executive Notes Slide Footer */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs text-slate-600 font-black">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Analyse consolidée basée sur les dates de création SWO et de clôture officielles.</span>
            </div>
            <span className="font-mono text-[10px] uppercase text-slate-400">GM-REPORT-PPT-V1</span>
          </div>
        </div>
      )}

      {(viewMode === 'full' || currentSlide === 2) && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm space-y-6 relative overflow-hidden">
          {/* PPT Slide Banner */}
          <div className="flex justify-between items-start border-b-2 border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                  SLIDE 02
                </span>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Analyse Dynamique</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                SWO Entrants/Sortants & Efficacité Opérationnelle
              </h3>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-slate-500 text-xs font-bold">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Capacité de Production</span>
            </div>
          </div>

          {/* Side-by-side Chart Slide */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 min-h-[450px] flex flex-col justify-between group transition-all duration-300 hover:shadow-md" ref={flowChartRef}>
              <div>
                <div className="flex justify-between items-center mb-4 shrink-0">
                  <h4 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <Timer className="w-5 h-5 text-blue-600" /> 
                    1. Volumes Globaux (SWO Entrants vs Sortants)
                  </h4>
                  <button onClick={() => downloadChartAsJpg(flowChartRef, 'gm_flux')} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <div className="h-[270px] w-full relative">
                  <ResponsiveContainer width="99%" height={270}>
                    <BarChart 
                      data={stats.flowData} 
                      onClick={(data) => data?.activePayload && handleDrillDown(data.activePayload[0].payload, 'FLOW')}
                      className="cursor-pointer"
                      margin={{ top: 25, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" /> 
                      <XAxis dataKey="name" tick={{fontSize: 11, fontWeight: 900, fill: '#0f172a'}} axisLine={false} tickLine={false} /> 
                      <YAxis tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} axisLine={false} tickLine={false} /> 
                      <Tooltip 
                        cursor={{fill: 'rgba(241, 245, 249, 0.8)'}} 
                        contentStyle={{ borderRadius: '15px', border: '1px solid #cbd5e1', boxShadow: '0 10px 20px rgba(0,0,0,0.08)' }}
                      />
                      <Bar dataKey="value" barSize={55} shape={<ThreeDBarVertical />}>
                         {stats.flowData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                         <LabelList dataKey="value" position="top" fill="#0f172a" fontSize={16} fontWeight={900} offset={8} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Projection Summary Box */}
              <div className="mt-4 p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-200/80 text-xs text-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-black text-indigo-900 uppercase text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Note de Projection : Équilibre des Volumes</span>
                </div>
                <p className="text-slate-700 leading-snug font-medium">
                  <strong>{stats.totals.totalCreatedInPeriod}</strong> entrées enregistrées vs <strong>{stats.totals.totalClosedInPeriod}</strong> fermetures totales. {stats.totals.totalClosedInPeriod >= stats.totals.totalCreatedInPeriod ? 'La capacité d\'extinction surpasse les entrées (dépollution positive du stock).' : 'Le volume de SWO entrants dépasse le rythme de clôture immédiate (vigilance requise).'}
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 min-h-[450px] flex flex-col justify-between group transition-all duration-300 hover:shadow-md" ref={efficiencyChartRef}>
              <div>
                <div className="flex justify-between items-center mb-4 shrink-0">
                  <h4 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    2. SWO Clos, Backlog et Pending du Mois
                  </h4>
                  <button onClick={() => downloadChartAsJpg(efficiencyChartRef, 'gm_performance')} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <div className="h-[270px] w-full relative">
                  <ResponsiveContainer width="99%" height={270}>
                    <BarChart 
                      data={stats.efficiencyData} 
                      onClick={(data) => data?.activePayload && handleDrillDown(data.activePayload[0].payload, 'EFFICIENCY')}
                      className="cursor-pointer"
                      margin={{ top: 25, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" /> 
                      <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 900, fill: '#0f172a'}} axisLine={false} tickLine={false} /> 
                      <YAxis tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} axisLine={false} tickLine={false} /> 
                      <Tooltip 
                         cursor={{fill: 'rgba(241, 245, 249, 0.8)'}} 
                         contentStyle={{ borderRadius: '15px', border: '1px solid #cbd5e1', boxShadow: '0 10px 20px rgba(0,0,0,0.08)' }}
                      />
                      <Bar dataKey="value" barSize={45} shape={<ThreeDBarVertical />}>
                         {stats.efficiencyData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                         <LabelList dataKey="value" position="top" fill="#0f172a" fontSize={16} fontWeight={900} offset={8} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Projection Summary Box */}
              <div className="mt-4 p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 text-xs text-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-black text-emerald-900 uppercase text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Note de Projection : Ventilation de la Production</span>
                </div>
                <p className="text-slate-700 leading-snug font-medium">
                  <strong>{stats.totals.createdAndClosedInPeriod}</strong> SWO clos directement le mois même, <strong>{stats.totals.backlogResolvedInPeriod}</strong> anciens SWO dépollués, laissant <strong>{stats.totals.remainingFromPeriod}</strong> SWO en suspens sur la période.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {(viewMode === 'full' || currentSlide === 3) && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm space-y-6 relative overflow-hidden">
          {/* PPT Slide Banner */}
          <div className="flex justify-between items-start border-b-2 border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                  SLIDE 03
                </span>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Répartition & Découpage</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                Analyse des SWO Période
              </h3>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-slate-500 text-xs font-bold">
              <Globe className="w-4 h-4 text-indigo-600" />
              <span>Répartition Régionale</span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Status X Chart */}
            <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 flex flex-col justify-between group transition-all duration-300 hover:shadow-md min-h-[460px]" ref={pendingChartRef}>
              <div>
                <div className="flex justify-between items-center mb-6 shrink-0">
                  <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    Ventilation par Statut X (Bloquants / En Cours)
                  </h4>
                  <button onClick={() => downloadChartAsJpg(pendingChartRef, 'gm_stock_x')} className="p-2 text-slate-400 hover:text-indigo-600">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <div className="h-[280px] w-full relative">
                  <ResponsiveContainer width="99%" height={280}>
                    <BarChart data={stats.pendingXData} layout="vertical" margin={{ left: 20, right: 35, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" /> 
                      <XAxis type="number" tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} axisLine={false} tickLine={false} /> 
                      <YAxis dataKey="name" type="category" width={190} fontSize={10} tick={{fontWeight: 900, fill: '#0f172a'}} axisLine={false} tickLine={false} /> 
                      <Tooltip 
                        cursor={{fill: 'rgba(241, 245, 249, 0.8)'}} 
                        contentStyle={{ borderRadius: '15px', border: '1px solid #cbd5e1', boxShadow: '0 10px 20px rgba(0,0,0,0.08)' }}
                      />
                      <Bar dataKey="value" barSize={32} shape={<ThreeDBarHorizontal />}>
                         {stats.pendingXData.map((entry, index) => <Cell key={`cell-${index}`} fill={PENDING_X_COLORS[entry.name] || COLORS.tvx} />)}
                         <LabelList dataKey="value" position="right" fill="#0f172a" fontSize={15} fontWeight={900} offset={8} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Projection Summary Box */}
              <div className="mt-4 p-3.5 bg-purple-50/60 rounded-xl border border-purple-200/80 text-xs text-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-black text-purple-900 uppercase text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>Note de Projection : Analyse des Blocages</span>
                </div>
                <p className="text-slate-700 leading-snug font-medium">
                  Motif principal de rétention : <strong>{stats.pendingXData[0]?.name || 'Non renseigné'}</strong> avec <strong>{stats.pendingXData[0]?.value || 0} SWO</strong> ({stats.totals.remainingFromPeriod > 0 ? Math.round(((stats.pendingXData[0]?.value || 0) / stats.totals.remainingFromPeriod) * 100) : 0}% des SWO). Action prioritaire recommandée pour débloquer les traitements.
                </p>
              </div>
            </div>

            {/* Regional SWO Table */}
            <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 flex flex-col justify-between group transition-all duration-300 hover:shadow-md relative overflow-hidden min-h-[460px]">
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start mb-4 shrink-0 gap-2">
                  <div>
                    <h4 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-indigo-600" /> 
                      SWO Période par Région
                    </h4>
                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mt-0.5">Ventilation des SWO créés non clos par secteur</p>
                  </div>
                  <div className="bg-indigo-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-black uppercase shadow-sm border border-indigo-500 tracking-wider">
                    {stats.totals.remainingFromPeriod} UNITÉS EN SUSPENS
                  </div>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar max-h-[250px]">
                  <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead>
                      <tr className="bg-slate-900 text-slate-100 text-[10px] font-black uppercase tracking-widest shadow-sm">
                        <th className="px-4 py-3 rounded-l-xl">Région / Zone</th>
                        <th className="px-4 py-3 text-center">Volume SWO</th>
                        <th className="px-4 py-3">Part %</th>
                        <th className="px-4 py-3 text-right rounded-r-xl">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.regionStats.length > 0 ? (
                        stats.regionStats.map((item, idx) => {
                          const percentage = Math.round((item.count / (stats.totals.remainingFromPeriod || 1)) * 100);
                          return (
                            <tr key={idx} className="bg-slate-50 hover:bg-indigo-50 transition-all group/row cursor-pointer border border-slate-200" onClick={() => handleRegionDrillDown(item.name)}>
                              <td className="px-4 py-3 rounded-l-xl">
                                <div className="flex items-center gap-2.5">
                                  <Tag className="w-4 h-4 text-indigo-600" />
                                  <span className="text-xs font-black text-slate-900 uppercase tracking-tight group-hover/row:text-indigo-600">{item.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-sm font-black text-indigo-800 bg-indigo-100 px-3 py-1 rounded-xl border border-indigo-200 shadow-2xs inline-block">{item.count}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-24 h-2.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                      className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">{percentage}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 rounded-r-xl text-right">
                                <ArrowRight className="w-4 h-4 text-slate-400 group-hover/row:text-indigo-600 group-hover/row:translate-x-1 transition-all" />
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-12 text-center opacity-40">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <p className="text-xs font-black uppercase">Aucun SWO résiduel sur la période</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Projection Summary Box */}
              <div className="mt-4 p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 text-xs text-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-black text-blue-900 uppercase text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Note de Projection : Répartition Géographique</span>
                </div>
                <p className="text-slate-700 leading-snug font-medium">
                  Secteur à plus forte concentration : <strong>{stats.regionStats[0]?.name || 'Inconnue'}</strong> avec <strong>{stats.regionStats[0]?.count || 0} SWO</strong> ({stats.totals.remainingFromPeriod > 0 ? Math.round(((stats.regionStats[0]?.count || 0) / stats.totals.remainingFromPeriod) * 100) : 0}% de l'en-cours résiduel). Zone d'intervention prioritaire pour les opérations.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {(viewMode === 'full' || currentSlide === 4) && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm space-y-6 relative overflow-hidden">
          {/* PPT Slide Banner */}
          <div className="flex justify-between items-start border-b-2 border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                  SLIDE 04
                </span>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Analyse Quali & Plan d'Action</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                Top 5 des Problématiques Critiques & Solutions
              </h3>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-slate-500 text-xs font-bold">
              <ListFilter className="w-4 h-4 text-indigo-600" />
              <span>Analyse de la colonne Description (Raw Data)</span>
            </div>
          </div>

          {/* Top Summary Banner for Slide 4 */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border-2 border-indigo-500/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-black text-indigo-300 uppercase tracking-wider">Analyse Sémantique — Mois Sélectionné</span>
                <span className="ml-2 px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-black rounded-lg">
                  Période : {period.start} au {period.end}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-200">
                Catégorisation rigoureuse sur la période sélectionnée basée sur l'analyse sémantique des descriptions d'incidents déclarés dans les SWO.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">SWO du Mois Analysés</span>
                <span className="text-lg font-black text-white">{topProblems.totalAnalyzed}</span>
              </div>
              <div className="bg-indigo-600 px-4 py-2 rounded-xl text-center shadow-sm">
                <span className="block text-[10px] font-bold text-indigo-200 uppercase">Top Problématique</span>
                <span className="text-lg font-black text-white">{topProblems.topCategories[0]?.count || 0} SWO</span>
              </div>
            </div>
          </div>

          {/* Grid of Top 5 Critical Problems & Solutions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {topProblems.topCategories.map((item, idx) => {
              const CategoryIcon = item.icon;
              return (
                <div 
                  key={item.id} 
                  className={`bg-white p-6 rounded-2xl border-2 ${item.borderAccent} shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4 relative overflow-hidden`}
                >
                  {/* Card Header */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${item.badgeColor} shadow-2xs`}>
                        {item.badgeText}
                      </span>
                      <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-xl text-slate-900 border border-slate-200">
                        <span className="text-xs font-black">{item.count} SWO</span>
                        <span className="text-[10px] font-extrabold text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-1">
                      <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 shrink-0">
                        <CategoryIcon className="w-5 h-5" />
                      </div>
                      <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                        {idx + 1}. {item.category}
                      </h4>
                    </div>
                  </div>

                  {/* Problem Description Box */}
                  <div className={`p-4 rounded-xl border ${item.problemBg} space-y-1.5`}>
                    <div className="flex items-center gap-1.5 font-black text-red-700 uppercase text-[11px]">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Problème Identifié (Motif Récurrent) :</span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                      {item.problem}
                    </p>
                  </div>

                  {/* Solution Box */}
                  <div className={`p-4 rounded-xl border ${item.solutionBg} space-y-1.5`}>
                    <div className="flex items-center gap-1.5 font-black text-emerald-800 uppercase text-[11px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Solution Recommandée & Plan d'Action :</span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                      {item.solution}
                    </p>
                  </div>

                  {/* Drilldown trigger */}
                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleProblemCategoryDrillDown(item.category, item.matchedRows)}
                      className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs group"
                    >
                      <span>Inspecter les {item.count} SWO</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Slide 4 Footer note */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs text-slate-600 font-black">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Analyse sémantique extraite directement des colonnes Description / Short description de la table Raw Data.</span>
            </div>
            <span className="font-mono text-[10px] uppercase text-slate-400">GM-SLIDE-04-QUAL</span>
          </div>
        </div>
      )}

      {(viewMode === 'full' || currentSlide === 5) && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-sm space-y-6 relative overflow-hidden">
          {/* PPT Slide Banner */}
          <div className="flex justify-between items-start border-b-2 border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                  SLIDE 05
                </span>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Success Room & CAPEX</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                Success Room Activité (SWO CAPEX Clos)
              </h3>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-slate-500 text-xs font-bold">
              <Zap className="w-4 h-4 text-amber-600" />
              <span>Correction GE, Hybride, Batteries Leoch & CAPEX</span>
            </div>
          </div>

          {/* Summary Banner */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border-2 border-amber-500/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black text-amber-300 uppercase tracking-wider">Analyse des SWO Fermés à Haute Valeur (CAPEX)</span>
                <span className="ml-2 px-2.5 py-0.5 bg-amber-500/30 text-amber-200 border border-amber-400/30 text-[10px] font-black rounded-lg">
                  Période : {period.start} au {period.end}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-200">
                Suivi des interventions de correction de fonctionnement des groupes électrogènes, systèmes hybrides, remplacement des batteries backup Leoch et investissements structurants clos sur la période.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-center">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">SWO Total Fermés</span>
                <span className="text-lg font-black text-white">{successRoomStats.totalClosed}</span>
              </div>
              <div className="bg-amber-600 px-4 py-2 rounded-xl text-center shadow-sm">
                <span className="block text-[10px] font-bold text-amber-100 uppercase">SWO CAPEX Clos</span>
                <span className="text-lg font-black text-white">{successRoomStats.totalCapex} ({successRoomStats.capexRatio}%)</span>
              </div>
            </div>
          </div>

          {/* CAPEX Categories Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: GE */}
            <div className="bg-white p-6 rounded-2xl border-2 border-red-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white">
                    CORRECTION FONCTIONNEMENT GE • CAPEX
                  </span>
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-xl text-slate-900 border border-slate-200">
                    <span className="text-xs font-black">{successRoomStats.geRows.length} SWO</span>
                    <span className="text-[10px] font-extrabold text-red-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {successRoomStats.totalCapex > 0 ? Math.round((successRoomStats.geRows.length / successRoomStats.totalCapex) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-red-50 text-red-700 shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    Groupes Électrogènes & Moteurs
                  </h4>
                </div>
              </div>
              <div className="p-4 rounded-xl border bg-red-50/80 border-red-200 text-slate-800 space-y-1.5">
                <p className="text-xs font-semibold leading-relaxed">
                  Interventions lourdes de remise en état des groupes électrogènes (révision moteur, remplacement d'alternateur, injecteurs, pompes et correction des défauts majeurs de génération).
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => handleProblemCategoryDrillDown("Correction GE & Moteurs (CAPEX)", successRoomStats.geRows)}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs group"
                >
                  <span>Inspecter les {successRoomStats.geRows.length} SWO</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Card 2: Hybrid */}
            <div className="bg-white p-6 rounded-2xl border-2 border-blue-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white">
                    SYSTÈMES HYBRIDES & SOLAIRE • CAPEX
                  </span>
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-xl text-slate-900 border border-slate-200">
                    <span className="text-xs font-black">{successRoomStats.hybridRows.length} SWO</span>
                    <span className="text-[10px] font-extrabold text-blue-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {successRoomStats.totalCapex > 0 ? Math.round((successRoomStats.hybridRows.length / successRoomStats.totalCapex) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700 shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    Hybridation & Énergie Solaire (PV)
                  </h4>
                </div>
              </div>
              <div className="p-4 rounded-xl border bg-blue-50/80 border-blue-200 text-slate-800 space-y-1.5">
                <p className="text-xs font-semibold leading-relaxed">
                  Optimisation et maintenance des systèmes hybrides et parcs solaires PV pour réduire la consommation de carburant et fiabiliser la production autonome des sites.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => handleProblemCategoryDrillDown("Systèmes Hybrides & Solaire (CAPEX)", successRoomStats.hybridRows)}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs group"
                >
                  <span>Inspecter les {successRoomStats.hybridRows.length} SWO</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Card 3: Batteries Leoch */}
            <div className="bg-white p-6 rounded-2xl border-2 border-purple-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white">
                    BATTERIES BACKUP & LEOCH • CAPEX
                  </span>
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-xl text-slate-900 border border-slate-200">
                    <span className="text-xs font-black">{successRoomStats.batteryRows.length} SWO</span>
                    <span className="text-[10px] font-extrabold text-purple-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {successRoomStats.totalCapex > 0 ? Math.round((successRoomStats.batteryRows.length / successRoomStats.totalCapex) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700 shrink-0">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    Changements des Batteries Backup et autres
                  </h4>
                </div>
              </div>
              <div className="p-4 rounded-xl border bg-purple-50/80 border-purple-200 text-slate-800 space-y-1.5">
                <p className="text-xs font-semibold leading-relaxed">
                  Remplacement planifié ou d'urgence des parcs de batteries de backup (notamment de marque Leoch et autres) pour garantir l'autonomie critique DC lors des coupures secteur.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => handleProblemCategoryDrillDown("Changements des Batteries Backup et autres", successRoomStats.batteryRows)}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-purple-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs group"
                >
                  <span>Inspecter les {successRoomStats.batteryRows.length} SWO</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Card 4: Other CAPEX */}
            <div className="bg-white p-6 rounded-2xl border-2 border-emerald-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                    AUTRES INVESTISSEMENTS • CAPEX
                  </span>
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-xl text-slate-900 border border-slate-200">
                    <span className="text-xs font-black">{successRoomStats.otherCapexRows.length} SWO</span>
                    <span className="text-[10px] font-extrabold text-emerald-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {successRoomStats.totalCapex > 0 ? Math.round((successRoomStats.otherCapexRows.length / successRoomStats.totalCapex) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    Autres Interventions CAPEX & Équipements
                  </h4>
                </div>
              </div>
              <div className="p-4 rounded-xl border bg-emerald-50/80 border-emerald-200 text-slate-800 space-y-1.5">
                <p className="text-xs font-semibold leading-relaxed">
                  Autres travaux de modernisation et de mise aux normes structurelles (redresseurs principaux, inverseurs ATS lourds, onduleurs et équipements énergie).
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => handleProblemCategoryDrillDown("Autres Interventions CAPEX", successRoomStats.otherCapexRows)}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs group"
                >
                  <span>Inspecter les {successRoomStats.otherCapexRows.length} SWO</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>

          {/* Slide 5 Footer note */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs text-slate-600 font-black">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Success Room Activité — Filtrage basé sur la clôture officielle des SWO à caractère CAPEX sur la période.</span>
            </div>
            <span className="font-mono text-[10px] uppercase text-slate-400">GM-SLIDE-05-SUCCESS-ROOM</span>
          </div>
        </div>
      )}

      {/* DRILLDOWN MODAL */}
      {drillDownData && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
             <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-3">
                   <div className="bg-indigo-600 p-2 rounded-xl">
                      <ListFilter className="w-5 h-5 text-white" />
                   </div>
                   <div>
                      <h3 className="text-lg font-black uppercase tracking-tight">{drillDownTitle}</h3>
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{drillDownData.length} Dossiers Identifiés</p>
                   </div>
                </div>
                <button onClick={() => setDrillDownData(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
             </div>
             <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-950">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                   {drillDownData.map((row, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all flex flex-col justify-between group">
                       <div>
                          <div className="flex justify-between items-start mb-3">
                             <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900 uppercase">
                                {row["State SWO"]}
                             </span>
                             <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black text-slate-400"># {row["N° SWO"]}</span>
                                <span className="text-[9px] font-mono font-bold text-indigo-500 mt-0.5 uppercase">{row["X"]}</span>
                             </div>
                          </div>
                          <h4 className="font-black text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 transition-colors uppercase truncate">{row["Nom du site"]}</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-3 flex items-center gap-1.5"><MapPin className="w-3 h-3 text-indigo-500" /> {row["Region"]}</p>
                          <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl mb-4 italic line-clamp-2 leading-relaxed border border-slate-100 dark:border-slate-800">
                             {row["Description"] || row["Short description"] || "Pas de description."}
                          </div>
                       </div>
                       <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                          <button 
                            onClick={() => { onFilterChange("N° SWO", String(row["N° SWO"])); onSwitchToData(); setDrillDownData(null); }}
                            className="w-full py-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                             Inspecter le dossier
                          </button>
                       </div>
                    </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
