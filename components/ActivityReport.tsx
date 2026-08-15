import React, { useState, useMemo } from 'react';
import { GlobalFileRow } from '../types';
import { parseDate, formatDate } from '../utils/dateHelpers';
import { 
  Calendar, ChevronLeft, ChevronRight, 
  FileText, Battery as BatteryIcon, 
  Settings2, ClipboardList, CheckSquare, Clock, 
  User, MapPin, Search, ArrowRight, BarChart3, FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';

const SLA_CONFIG: Record<string, number> = {
  'P0': 24,
  'P1': 72,
  'P2': 168,
  'P3': 720,
  'P4': Infinity
};

const getPriorityKey = (row: GlobalFileRow): string => {
  const rawPrio = String(row["Priorité"] || "").toUpperCase();
  if (rawPrio.includes('0') || rawPrio.includes('P0')) return 'P0';
  if (rawPrio.includes('1') || rawPrio.includes('P1')) return 'P1';
  if (rawPrio.includes('2') || rawPrio.includes('P2')) return 'P2';
  if (rawPrio.includes('3') || rawPrio.includes('P3')) return 'P3';
  if (rawPrio.includes('4') || rawPrio.includes('P4')) return 'P4';
  return 'Autre';
};

const getTTFStatus = (row: GlobalFileRow) => {
  const priority = getPriorityKey(row);
  const limitHours = SLA_CONFIG[priority];
  if (limitHours === undefined) {
    return { priority, durationHours: null, limitHours: Infinity, exceeded: false };
  }

  const startDate = parseDate(row["Date de création du SWO"]) || parseDate(row["Date de remontée"]);
  if (!startDate) {
    return { priority, durationHours: null, limitHours, exceeded: false };
  }

  const endDate = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
  const referenceDate = endDate || new Date('2026-07-11T14:33:29');

  const diffMs = referenceDate.getTime() - startDate.getTime();
  const durationHours = diffMs / (1000 * 60 * 60);

  if (durationHours < 0) {
    return { priority, durationHours, limitHours, exceeded: false };
  }

  return {
    priority,
    durationHours,
    limitHours,
    exceeded: limitHours !== Infinity && durationHours > limitHours
  };
};

interface ActivityReportProps {
  data: GlobalFileRow[];
}

export const ActivityReport: React.FC<ActivityReportProps> = ({ data }) => {
  // Find the most recent date in data to use as baseline default, otherwise use today's date in 2026
  const defaultBaseDateStr = useMemo(() => {
    let maxDate = new Date('2026-07-11');
    data.forEach(row => {
      const closing = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
      const creation = parseDate(row["Date de création du SWO"]) || parseDate(row["Date de remontée"]);
      const pmDate = parseDate(row["PM Date"]);
      [closing, creation, pmDate].forEach(d => {
        if (d && d > maxDate && d.getFullYear() <= 2026) {
          maxDate = d;
        }
      });
    });
    return maxDate.toISOString().split('T')[0];
  }, [data]);

  const [periodType, setPeriodType] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('MONTHLY');
  const [selectedDate, setSelectedDate] = useState<string>(defaultBaseDateStr);
  const [activeDetailFilter, setActiveDetailFilter] = useState<string>('SWO_CLOSED');
  const [detailSearchTerm, setDetailSearchTerm] = useState<string>('');

  // TAS standard SLA threshold in days
  const [tasSlaThreshold, setTasSlaThreshold] = useState<number>(3);

  // Helper to compute start & end range
  const periodRange = useMemo(() => {
    const baseDate = new Date(selectedDate);
    if (isNaN(baseDate.getTime())) {
      const today = new Date();
      return { start: today, end: today };
    }

    let start = new Date(baseDate);
    let end = new Date(baseDate);

    if (periodType === 'DAILY') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (periodType === 'WEEKLY') {
      // Find Monday
      const day = baseDate.getDay();
      const diffToMonday = baseDate.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diffToMonday);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      // Monthly
      start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    return { start, end };
  }, [periodType, selectedDate]);

  // Navigate back/forth
  const handleNavigatePeriod = (direction: 'PREV' | 'NEXT') => {
    const current = new Date(selectedDate);
    if (isNaN(current.getTime())) return;

    if (periodType === 'DAILY') {
      current.setDate(current.getDate() + (direction === 'PREV' ? -1 : 1));
    } else if (periodType === 'WEEKLY') {
      current.setDate(current.getDate() + (direction === 'PREV' ? -7 : 7));
    } else {
      current.setMonth(current.getMonth() + (direction === 'PREV' ? -1 : 1));
    }

    setSelectedDate(current.toISOString().split('T')[0]);
  };

  // Human period description
  const formattedPeriodLabel = useMemo(() => {
    const { start, end } = periodRange;
    const formatFull = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const formatMonth = (d: Date) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    if (periodType === 'DAILY') {
      return formatFull(start);
    } else if (periodType === 'WEEKLY') {
      return `Du ${start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} au ${formatFull(end)}`;
    } else {
      return formatMonth(start).toUpperCase();
    }
  }, [periodRange, periodType]);

  // Main reports metric compiler
  const stats = useMemo(() => {
    const { start, end } = periodRange;

    // SWO
    const createdSwo: GlobalFileRow[] = [];
    const closedSwo: GlobalFileRow[] = [];

    // Courroies (Belts)
    const createdBelt: GlobalFileRow[] = [];
    const replacedBelt: GlobalFileRow[] = [];

    // Batteries
    const createdBattery: GlobalFileRow[] = [];
    const replacedBattery: GlobalFileRow[] = [];

    // TAS
    const tasOnTime: GlobalFileRow[] = [];
    const tasLate: GlobalFileRow[] = [];

    // PM
    const pmOnTime: GlobalFileRow[] = [];
    const pmLate: GlobalFileRow[] = [];

    data.forEach(row => {
      const creationDate = parseDate(row["Date de création du SWO"]) || parseDate(row["Date de remontée"]);
      const closingDate = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
      const stateVal = String(row["State SWO"] || row["status"] || "").toUpperCase();

      // 1. SWO created vs closed
      if (creationDate && creationDate >= start && creationDate <= end) {
        createdSwo.push(row);
      }
      if (closingDate && closingDate >= start && closingDate <= end && stateVal === "CLOSED") {
        closedSwo.push(row);
      }

      // 2. Courroies
      const desc = String(row["Description"] || "").toLowerCase();
      const isBelt = desc.includes("courroie") || desc.includes("belt") || desc.includes("swap courroie") || desc.includes("remplacement courroie");

      if (isBelt) {
        if (creationDate && creationDate >= start && creationDate <= end) {
          createdBelt.push(row);
        }
        if (closingDate && closingDate >= start && closingDate <= end && stateVal === "CLOSED") {
          replacedBelt.push(row);
        }
      }

      // 3. Batteries
      const batteryKeywords = ["swap battery ge", "remplacement batterie ge", "remplacement battery ge"];
      const isBattery = batteryKeywords.some(k => desc.includes(k));

      if (isBattery) {
        if (creationDate && creationDate >= start && creationDate <= end) {
          createdBattery.push(row);
        }
        if (closingDate && closingDate >= start && closingDate <= end && stateVal === "CLOSED") {
          replacedBattery.push(row);
        }
      }

      // 4. TAS closed within delay vs out of delay
      const tasStatus = String(row["TAS Status"] || "").trim();
      const hasTas = tasStatus && tasStatus !== "N/A" && tasStatus.toUpperCase() !== "NON DÉFINI";

      if (hasTas && closingDate && closingDate >= start && closingDate <= end && stateVal === "CLOSED") {
        if (creationDate) {
          const diffDays = Math.ceil(Math.abs(closingDate.getTime() - creationDate.getTime()) / (1000 * 3600 * 24));
          if (diffDays <= tasSlaThreshold) {
            tasOnTime.push(row);
          } else {
            tasLate.push(row);
          }
        } else {
          tasOnTime.push(row); // Par défaut dans les délais si pas de date de création
        }
      }

      // 5. PM clos dans le délai vs hors délai
      const pmNum = String(row["PM number"] || "").trim();
      if (pmNum) {
        const pmExecDate = parseDate(row["PM date execute"]) || parseDate(row["Date executee"]);
        const pmPlanDate = parseDate(row["PM Date"]) || parseDate(row["PM Planned"]);
        const hasReplan = !!row["PM date replanifiée"];

        if (pmExecDate && pmExecDate >= start && pmExecDate <= end) {
          const isLate = hasReplan || (pmPlanDate && pmExecDate > pmPlanDate);
          if (!isLate) {
            pmOnTime.push(row);
          } else {
            pmLate.push(row);
          }
        }
      }
    });

    return {
      createdSwo,
      closedSwo,
      createdBelt,
      replacedBelt,
      createdBattery,
      replacedBattery,
      tasOnTime,
      tasLate,
      pmOnTime,
      pmLate,
    };
  }, [data, periodRange, tasSlaThreshold]);

  // Determine standard grid items to show in visual list below
  const listData = useMemo(() => {
    switch (activeDetailFilter) {
      case 'SWO_CREATED': return stats.createdSwo;
      case 'SWO_CLOSED': return stats.closedSwo;
      case 'BELT_CREATED': return stats.createdBelt;
      case 'BELT_REPLACED': return stats.replacedBelt;
      case 'BATTERY_CREATED': return stats.createdBattery;
      case 'BATTERY_REPLACED': return stats.replacedBattery;
      case 'TAS_ON_TIME': return stats.tasOnTime;
      case 'TAS_LATE': return stats.tasLate;
      case 'PM_ON_TIME': return stats.pmOnTime;
      case 'PM_LATE': return stats.pmLate;
      default: return stats.closedSwo;
    }
  }, [stats, activeDetailFilter]);

  const filteredDetailList = useMemo(() => {
    if (!detailSearchTerm) return listData;
    const s = detailSearchTerm.toLowerCase();
    return listData.filter(row => 
      String(row["Nom du site"] || row["ID"] || "").toLowerCase().includes(s) ||
      String(row["N° SWO"] || "").toLowerCase().includes(s) ||
      String(row["Description"] || "").toLowerCase().includes(s) ||
      String(row["Assigned to"] || row["Intervenant"] || "").toLowerCase().includes(s)
    );
  }, [listData, detailSearchTerm]);

  // Download XLS Report function
  const handleExportXls = () => {
    const wb = XLSX.utils.book_new();

    const addSheet = (rows: GlobalFileRow[], name: string) => {
      if (rows.length === 0) return;
      const cleanRows = rows.map(r => {
        const ttfStat = getTTFStatus(r);
        return {
          ID: r["ID"],
          "Nom du site": r["Nom du site"] || r["Names site"],
          Région: r["Region"],
          "N° SWO": r["N° SWO"],
          "Priorité": ttfStat.priority,
          "Limite SLA (h)": ttfStat.limitHours === Infinity ? "N/A" : ttfStat.limitHours,
          "Durée Réelle (h)": ttfStat.durationHours !== null ? Math.round(ttfStat.durationHours) : "N/A",
          "Dépassement SLA": ttfStat.exceeded ? "Oui" : "Non",
          "Date de création": formatDate(r["Date de création du SWO"] || r["Date de remontée"]),
          "Date de Clôture": formatDate(r["Closing date"] || r["Date de Clôture"]),
          Description: r["Description"] || r["Short description"],
          "TAS Statut": r["TAS Status"],
          Intervenant: r["Assigned to"] || r["Intervenant"] || r["FE names"]
        };
      });
      const ws = XLSX.utils.json_to_sheet(cleanRows);
      XLSX.utils.book_append_sheet(wb, ws, name);
    };

    addSheet(stats.createdSwo, "SWO Créés");
    addSheet(stats.closedSwo, "SWO Clos");
    addSheet(stats.replacedBelt, "Courroies Remplacées");
    addSheet(stats.replacedBattery, "Batteries Remplacées");
    addSheet(stats.tasOnTime, "TAS Respect Délais");
    addSheet(stats.tasLate, "TAS Retardataires");
    addSheet(stats.pmOnTime, "PM Respect Délais");
    addSheet(stats.pmLate, "PM Retardataires");

    const safeFilename = `Rapport_Activite_${periodType}_${selectedDate}.xlsx`;
    XLSX.writeFile(wb, safeFilename);
  };

  const tasComplianceRate = useMemo(() => {
    const total = stats.tasOnTime.length + stats.tasLate.length;
    return total > 0 ? Math.round((stats.tasOnTime.length / total) * 100) : 100;
  }, [stats]);

  const pmComplianceRate = useMemo(() => {
    const total = stats.pmOnTime.length + stats.pmLate.length;
    return total > 0 ? Math.round((stats.pmOnTime.length / total) * 100) : 100;
  }, [stats]);

  return (
    <div className="p-6 space-y-8 bg-[#F8FAFC] min-h-full font-sans">
      
      {/* HEADER SECTION */}
      <div className="bg-white p-4 sm:p-8 rounded-3xl sm:rounded-[3.5rem] shadow-sm border border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sm:gap-8">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="bg-gradient-to-tr from-indigo-600 to-indigo-500 p-3.5 sm:p-5 rounded-2xl sm:rounded-[2rem] shadow-lg sm:shadow-xl shadow-indigo-100/50 text-white shrink-0">
            <BarChart3 className="w-6 h-6 sm:w-10 sm:h-10" />
          </div>
          <div>
            <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tighter uppercase flex flex-wrap items-center gap-1.5 sm:gap-3 leading-tight">
              Rapports <span className="text-indigo-600">d'Activité</span>
            </h2>
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider mt-1 leading-normal">
              Bilan complet des interventions et des délais de traitement
            </p>
          </div>
        </div>

        {/* CONTROLLER BAR */}
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          {/* Period type switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
            {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setPeriodType(type)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                  periodType === type 
                    ? 'bg-slate-950 text-white shadow-md' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {type === 'DAILY' ? 'Jour' : type === 'WEEKLY' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>

          {/* Date Selector and navigation */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/50 p-2.5 rounded-2xl shadow-inner shrink-0">
            <button 
              onClick={() => handleNavigatePeriod('PREV')} 
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex flex-col items-center px-2">
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="bg-transparent border-none text-xs font-black text-indigo-600 outline-none focus:ring-0 cursor-pointer text-center p-0"
              />
            </div>

            <button 
              onClick={() => handleNavigatePeriod('NEXT')} 
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Export XLS */}
          <button
            onClick={handleExportXls}
            className="flex items-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black tracking-wider shadow-lg shadow-emerald-100 transition-all cursor-pointer w-full sm:w-auto justify-center"
          >
            <FileSpreadsheet className="w-4 h-4" />
            EXPORTER XLS
          </button>
        </div>
      </div>

      {/* PERIOD ACTIVE METRIC */}
      <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-4 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/15 rounded-xl border border-indigo-500/20 text-indigo-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">Rapport consolidé pour la période</span>
            <h3 className="text-lg font-black uppercase tracking-tight">{formattedPeriodLabel}</h3>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="text-center bg-slate-800/50 px-6 py-3 rounded-2xl border border-slate-800/40 min-w-[120px]">
            <p className="text-[9px] font-black text-slate-400 uppercase">SWO Créés</p>
            <p className="text-2xl font-black text-indigo-300 mt-1">{stats.createdSwo.length}</p>
          </div>
          <div className="text-center bg-slate-800/50 px-6 py-3 rounded-2xl border border-slate-800/40 min-w-[120px]">
            <p className="text-[9px] font-black text-slate-400 uppercase">SWO Clos</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{stats.closedSwo.length}</p>
          </div>
        </div>
      </div>

      {/* MAIN METRIC BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        
        {/* CARD 1: SWO CREATED VS CLOSED */}
        <div 
          onClick={() => setActiveDetailFilter('SWO_CLOSED')}
          className={`cursor-pointer p-6 rounded-[2.5rem] border transition-all duration-300 flex flex-col justify-between h-72 relative overflow-hidden group ${
            activeDetailFilter.startsWith('SWO_')
              ? 'bg-white border-indigo-500 shadow-xl ring-2 ring-indigo-500/10'
              : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[9px] font-black px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg uppercase tracking-wider">Mouvement SWO</span>
              <FileText className="w-5 h-5 text-indigo-400" />
            </div>
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-tight">SWO Créés vs Clôturés</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Analyse du flux de tickets</p>
          </div>

          <div className="space-y-4 my-2">
            <div className="flex justify-between text-xs font-black">
              <span className="text-indigo-600">Créés: {stats.createdSwo.length}</span>
              <span className="text-emerald-600">Clos: {stats.closedSwo.length}</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div 
                className="bg-indigo-500 h-full transition-all" 
                style={{ width: `${stats.createdSwo.length + stats.closedSwo.length > 0 ? (stats.createdSwo.length / (stats.createdSwo.length + stats.closedSwo.length)) * 100 : 50}%` }} 
              />
              <div 
                className="bg-emerald-500 h-full transition-all" 
                style={{ width: `${stats.createdSwo.length + stats.closedSwo.length > 0 ? (stats.closedSwo.length / (stats.createdSwo.length + stats.closedSwo.length)) * 100 : 50}%` }} 
              />
            </div>
          </div>

          <div className="pt-2 border-t border-dashed flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
            <span>Cliquez pour détailler</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* CARD 2: COURROIES REPLACED VS CREATED */}
        <div 
          onClick={() => setActiveDetailFilter('BELT_REPLACED')}
          className={`cursor-pointer p-6 rounded-[2.5rem] border transition-all duration-300 flex flex-col justify-between h-72 relative overflow-hidden group ${
            activeDetailFilter.startsWith('BELT_')
              ? 'bg-white border-indigo-500 shadow-xl ring-2 ring-indigo-500/10'
              : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[9px] font-black px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg uppercase tracking-wider">Organes Moteur</span>
              <Settings2 className="w-5 h-5 text-slate-500" />
            </div>
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-tight">Courroie Remplacée vs Créée</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Maintenance des courroies</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Remplacées</span>
              <span className="text-xl font-black text-slate-800">{stats.replacedBelt.length}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Créées (Swo)</span>
              <span className="text-xl font-black text-indigo-600">{stats.createdBelt.length}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-dashed flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
            <span>Cliquez pour détailler</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* CARD 3: BATTERY REPLACED VS CREATED */}
        <div 
          onClick={() => setActiveDetailFilter('BATTERY_REPLACED')}
          className={`cursor-pointer p-6 rounded-[2.5rem] border transition-all duration-300 flex flex-col justify-between h-72 relative overflow-hidden group ${
            activeDetailFilter.startsWith('BATTERY_')
              ? 'bg-white border-indigo-500 shadow-xl ring-2 ring-indigo-500/10'
              : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[9px] font-black px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg uppercase tracking-wider">Batteries</span>
              <BatteryIcon className="w-5 h-5 text-amber-500" />
            </div>
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-tight">Batterie Remplacée vs Créée</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Suivi du parc batteries</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Remplacées</span>
              <span className="text-xl font-black text-slate-800">{stats.replacedBattery.length}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Créées (Swo)</span>
              <span className="text-xl font-black text-amber-600">{stats.createdBattery.length}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-dashed flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
            <span>Cliquez pour détailler</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* CARD 4: TAS IN DELAY VS OUT OF DELAY */}
        <div 
          onClick={() => setActiveDetailFilter('TAS_ON_TIME')}
          className={`cursor-pointer p-6 rounded-[2.5rem] border transition-all duration-300 flex flex-col justify-between h-72 relative overflow-hidden group ${
            activeDetailFilter.startsWith('TAS_')
              ? 'bg-white border-indigo-500 shadow-xl ring-2 ring-indigo-500/10'
              : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[9px] font-black px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg uppercase tracking-wider">SLA TAS</span>
              <ClipboardList className="w-5 h-5 text-emerald-500" />
            </div>
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-tight">TAS dans le Délai vs Hors</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Qualité de traitement (SLA {tasSlaThreshold}j)</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-black text-emerald-600 uppercase">Respecté ({tasComplianceRate}%)</span>
              <span className="text-xl font-black text-emerald-600">{stats.tasOnTime.length}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-black text-rose-500 uppercase">Hors délai</span>
              <span className="text-xl font-black text-rose-500">{stats.tasLate.length}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-dashed flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
            <span>Cliquez pour détailler</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* CARD 5: PM IN DELAY VS OUT OF DELAY */}
        <div 
          onClick={() => setActiveDetailFilter('PM_ON_TIME')}
          className={`cursor-pointer p-6 rounded-[2.5rem] border transition-all duration-300 flex flex-col justify-between h-72 relative overflow-hidden group ${
            activeDetailFilter.startsWith('PM_')
              ? 'bg-white border-indigo-500 shadow-xl ring-2 ring-indigo-500/10'
              : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[9px] font-black px-2.5 py-1 bg-violet-50 text-violet-700 rounded-lg uppercase tracking-wider">SLA PM</span>
              <CheckSquare className="w-5 h-5 text-violet-500" />
            </div>
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-tight">PM dans le Délai vs Hors</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Conformité de planification</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-black text-violet-600 uppercase">Respecté ({pmComplianceRate}%)</span>
              <span className="text-xl font-black text-violet-600">{stats.pmOnTime.length}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-black text-amber-600 uppercase">Hors délai / Replanifié</span>
              <span className="text-xl font-black text-amber-600">{stats.pmLate.length}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-dashed flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
            <span>Cliquez pour détailler</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

      </div>

      {/* PARAMETERS AND SLA CONFIGURATION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TAS SLA Box */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-2.5 rounded-xl text-slate-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Ajuster le Seuil SLA Administratif TAS</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Configurez le délai de traitement des TAS</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/40 px-4 py-2 rounded-xl">
            <span className="text-xs font-black text-slate-500 uppercase">Seuil :</span>
            <input 
              type="number" 
              min={1} 
              max={30} 
              value={tasSlaThreshold} 
              onChange={(e) => setTasSlaThreshold(Math.max(1, parseInt(e.target.value) || 3))}
              className="w-14 text-center bg-transparent border-none text-xs font-black text-indigo-600 outline-none p-0 focus:ring-0"
            />
            <span className="text-xs font-black text-slate-400">jours</span>
          </div>
        </div>

        {/* Priority SLA Thresholds explanation */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex flex-col justify-center gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-rose-50 text-rose-500 p-2 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Seuils de Tolérance SLA TTF (Priorités SWO)</h4>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Les dossiers dépassant ces durées seront automatiquement mis en évidence en rouge</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-[9px] font-black px-2 py-1 bg-rose-50 text-rose-800 rounded-md border border-rose-100">P0 &lt; 24h</span>
            <span className="text-[9px] font-black px-2 py-1 bg-orange-50 text-orange-800 rounded-md border border-orange-100">P1 &lt; 72h</span>
            <span className="text-[9px] font-black px-2 py-1 bg-amber-50 text-amber-800 rounded-md border border-amber-100">P2 &lt; 168h (7j)</span>
            <span className="text-[9px] font-black px-2 py-1 bg-sky-50 text-sky-800 rounded-md border border-sky-100">P3 &lt; 720h (30j)</span>
            <span className="text-[9px] font-black px-2 py-1 bg-slate-100 text-slate-500 rounded-md border border-slate-200">P4 Sans Limite</span>
          </div>
        </div>
      </div>

      {/* DETAILED ACTIVE METRIC LIST */}
      <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-300">
        <div className="p-8 border-b border-slate-50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-50 p-3.5 rounded-2xl text-indigo-600">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                Détail : <span className="text-indigo-600 font-black uppercase">
                  {activeDetailFilter === 'SWO_CREATED' && 'SWO Créés'}
                  {activeDetailFilter === 'SWO_CLOSED' && 'SWO Fermés'}
                  {activeDetailFilter === 'BELT_CREATED' && 'Courroies - SWO de Remplacement Créés'}
                  {activeDetailFilter === 'BELT_REPLACED' && 'Courroies Remplacées'}
                  {activeDetailFilter === 'BATTERY_CREATED' && 'Batteries - SWO de Remplacement Créés'}
                  {activeDetailFilter === 'BATTERY_REPLACED' && 'Batteries Remplacées'}
                  {activeDetailFilter === 'TAS_ON_TIME' && 'TAS Clos dans le Délai'}
                  {activeDetailFilter === 'TAS_LATE' && 'TAS Clos Hors Délai'}
                  {activeDetailFilter === 'PM_ON_TIME' && 'PM Clos dans le Délai'}
                  {activeDetailFilter === 'PM_LATE' && 'PM Clos Hors Délai / Replanifiés'}
                </span>
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                {filteredDetailList.length} dossier(s) trouvé(s) sur cette période
              </p>
            </div>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher par Site, SWO..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              value={detailSearchTerm}
              onChange={(e) => setDetailSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* DETAILS TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">
                <th className="px-8 py-5">Site ID</th>
                <th className="px-6 py-5">Site & Région</th>
                <th className="px-6 py-5">Priorité / SLA TTF</th>
                <th className="px-6 py-5">N° SWO / PM Number</th>
                <th className="px-6 py-5 max-w-xs">Description</th>
                <th className="px-6 py-5">Intervenant</th>
                <th className="px-6 py-5 whitespace-nowrap">Création / Planif</th>
                <th className="px-8 py-5 text-right">Clôture / Exécution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredDetailList.length > 0 ? (
                filteredDetailList.map((row, idx) => {
                  const ttfStat = getTTFStatus(row);
                  const { priority, durationHours, limitHours, exceeded } = ttfStat;
                  return (
                    <tr 
                      key={idx} 
                      className={`transition-all border-l-4 ${
                        exceeded 
                          ? 'bg-rose-50/75 hover:bg-rose-100/90 border-l-rose-500 text-rose-950' 
                          : 'hover:bg-indigo-50/10 border-l-transparent'
                      }`}
                    >
                      <td className="px-8 py-5">
                        <span className="text-[11px] font-black text-slate-500 uppercase">{row["ID"] || "N/A"}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 uppercase leading-tight">{row["Nom du site"] || row["Names site"] || "Inconnu"}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {row["Region"] || "Inconnue"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg inline-block w-fit uppercase border ${
                            priority === 'P0' ? 'bg-rose-100/80 text-rose-800 border-rose-200' :
                            priority === 'P1' ? 'bg-orange-100/80 text-orange-800 border-orange-200' :
                            priority === 'P2' ? 'bg-amber-100/80 text-amber-800 border-amber-200' :
                            priority === 'P3' ? 'bg-sky-100/80 text-sky-800 border-sky-200' :
                            priority === 'P4' ? 'bg-slate-100/80 text-slate-800 border-slate-200' :
                            'bg-slate-50/80 text-slate-500 border-slate-100'
                          }`}>
                            {priority}
                          </span>
                          {durationHours !== null && limitHours !== Infinity && (
                            <span className={`text-[9.5px] font-mono font-bold flex items-center gap-1 ${exceeded ? 'text-rose-600' : 'text-slate-500'}`}>
                              {exceeded && <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />}
                              {Math.round(durationHours)}h / {limitHours}h
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {row["PM number"] ? (
                          <div className="flex flex-col">
                            <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60 inline-block w-fit">
                              PM: {row["PM number"]}
                            </span>
                            {row["N° SWO"] && <span className="text-[9px] text-slate-400 font-mono mt-1">SWO: {row["N° SWO"]}</span>}
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100/60 inline-block w-fit">
                            SWO: {row["N° SWO"] || "N/A"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 max-w-xs">
                        <p className="text-[11px] text-slate-600 font-medium line-clamp-2 leading-relaxed italic">
                          {row["Description"] || row["Short description"] || "Pas de description."}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                          <span className="text-[10px] font-black text-slate-700 uppercase">{row["Assigned to"] || row["Intervenant"] || row["FE names"] || "Non assigné"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-800">
                            {formatDate(row["Date de création du SWO"] || row["Date de remontée"] || row["PM Date"] || row["PM Planned"])}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase">
                            {row["PM Date"] ? "Prévu PM" : "Remontée SWO"}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`text-[11px] font-black ${exceeded ? 'text-rose-600 font-bold' : 'text-emerald-600'}`}>
                            {formatDate(row["Closing date"] || row["Date de Clôture"] || row["PM date execute"] || row["Date executee"])}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase">
                            {row["PM date execute"] || row["Date executee"] ? "Exécuté PM" : "Clôture SWO"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-8 py-20 text-center text-slate-300 italic opacity-40">
                    <Search className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">Aucun dossier à afficher pour ce filtre</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
