
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { GlobalFileRow, XStatus } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { ThreeDBarVertical } from './ThreeDShapes';
import { 
  Calendar, RefreshCw, Camera, ArrowRightLeft, ClipboardList, MapPin, 
  Clock, AlertCircle, TrendingUp, 
  CalendarCheck, X, Eye, ListFilter, CheckCircle2, AlertTriangle, FileWarning, Zap, MessageSquareOff, PlusCircle, Activity,
  ChevronDown, ChevronUp, Share2
} from 'lucide-react';
import { downloadChartAsJpg, shareOrDownloadElementAsPng } from '../utils/chartHelpers';
import { parseDate, formatDate } from '../utils/dateHelpers';

interface DailyStatusProps {
  data: GlobalFileRow[];
  onFilterChange: (column: string, value: string) => void;
  onSwitchToData: () => void;
}

const X_COLORS: Record<string, string> = {
  [XStatus.CLOSED]: "#22c55e",
  [XStatus.TVX_STHIC]: "#6366f1",
  [XStatus.STHIC_SPA]: "#3b82f6",
  [XStatus.STHIC_ATV_HTC]: "#eab308",
  [XStatus.HTC]: "#f97316",
  "Autre": "#9ca3af"
};

const X_KEYS = [XStatus.CLOSED, XStatus.TVX_STHIC, XStatus.STHIC_SPA, XStatus.STHIC_ATV_HTC, XStatus.HTC];

const getPriorityStyle = (priority: string) => {
  const p = String(priority).toUpperCase();
  if (p.includes('P0') || p.includes('0')) return 'bg-red-600 text-white border-red-700';
  if (p.includes('P1') || p.includes('1')) return 'bg-red-500 text-white border-red-600';
  if (p.includes('P2') || p.includes('2')) return 'bg-orange-500 text-white border-orange-600';
  if (p.includes('P3') || p.includes('3')) return 'bg-blue-500 text-white border-blue-600';
  return 'bg-gray-500 text-white border-gray-600';
};

const toInputDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const toDisplayDate = (dStr: string) => {
  if (!dStr) return '-';
  const [y, m, d] = dStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

export const DailyStatus: React.FC<DailyStatusProps> = ({ data, onFilterChange, onSwitchToData }) => {
  const [dateLeft, setDateLeft] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toInputDate(d);
  });
  const [dateRight, setDateRight] = useState(toInputDate(new Date()));

  const [drillDownData, setDrillDownData] = useState<GlobalFileRow[] | null>(null);
  const [drillDownTitle, setDrillDownTitle] = useState("");
  const [isYellowExpanded, setIsYellowExpanded] = useState(false);

  const chartLeftRef = useRef<HTMLDivElement>(null);
  const chartRightRef = useRef<HTMLDivElement>(null);
  const dailyStatusContainerRef = useRef<HTMLDivElement>(null);
  const dailyPlanSectionRef = useRef<HTMLDivElement>(null);
  const leftPlanRef = useRef<HTMLDivElement>(null);
  const rightPlanRef = useRef<HTMLDivElement>(null);

  const reviewStats = useMemo(() => {
    if (!dateRight) return { plannedTotal: 0, plannedOpen: 0, plannedClosed: 0, prodRatio: 0, yellowAlerts: [] };
    
    const [y, m, d] = dateRight.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    targetDate.setHours(0,0,0,0);
    const endTargetDate = new Date(y, m - 1, d);
    endTargetDate.setHours(23,59,59,999);

    // LOGIQUE SEMAINE : On remonte à 7 jours en arrière par rapport à la date cible
    const sevenDaysAgoDate = new Date(targetDate);
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);

    const plannedForToday = data.filter(row => {
      const d = parseDate(row["Date de planification"]);
      return d && d >= targetDate && d <= endTargetDate;
    });

    const plannedStillOpen = plannedForToday.filter(row => 
      String(row["State SWO"]).toUpperCase() !== "CLOSED"
    );

    const plannedAndClosed = plannedForToday.filter(row => 
      String(row["State SWO"]).toUpperCase() === "CLOSED"
    );

    const yellowBlocked = data.filter(row => {
      const xStatus = String(row["X"] || "").toUpperCase();
      // Un dossier est "Jaune" s'il est au statut 4 (STHIC ATV HTC)
      const isYellow = xStatus.includes("4-") || xStatus.includes("ATV") || xStatus.includes("VALIDATION HTC");
      
      const creationDate = parseDate(row["Date de création du SWO"]);
      // On vérifie s'il a été créé durant les 7 derniers jours
      const isRecentThisWeek = creationDate && creationDate >= sevenDaysAgoDate && creationDate <= endTargetDate;

      // Critères de lacunes administratives
      const hasNoFit = !row["N° FIT &/ou DP"] || String(row["N° FIT &/ou DP"]).trim() === "";
      const hasNoComment = !row["Commentaire"] || String(row["Commentaire"]).trim() === "";
      
      return isYellow && isRecentThisWeek && (hasNoFit || hasNoComment);
    });

    const totalPlanned = plannedForToday.length;
    const prodRatio = totalPlanned > 0 ? Math.round((plannedAndClosed.length / totalPlanned) * 100) : 0;

    return {
      plannedTotal: totalPlanned,
      plannedOpen: plannedStillOpen.length,
      plannedClosed: plannedAndClosed.length,
      prodRatio: prodRatio,
      yellowAlerts: yellowBlocked
    };
  }, [data, dateRight]);

  const getChartDataForDate = useCallback((targetDateStr: string) => {
    if (!targetDateStr) return [];
    const [y, m, d] = targetDateStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    targetDate.setHours(0,0,0,0);
    const endTargetDate = new Date(y, m - 1, d);
    endTargetDate.setHours(23,59,59,999);
    const regionMap: Record<string, Record<string, string | number>> = {};
    data.forEach(row => {
      const creationDate = parseDate(row["Date de création du SWO"]);
      const closingDate = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
      const xStatus = String(row["X"] || "Autre");
      const region = String(row["Region"] || "Non défini");
      
      const isCreated = creationDate && creationDate >= targetDate && creationDate <= endTargetDate;
      const isClosed = closingDate && closingDate >= targetDate && closingDate <= endTargetDate;

      if (isCreated || isClosed) {
         if (!regionMap[region]) {
           regionMap[region] = { name: region, total: 0 };
           X_KEYS.forEach(k => regionMap[region][k] = 0);
           regionMap[region]["Autre"] = 0;
         }
         if (X_KEYS.includes(xStatus as XStatus)) {
            regionMap[region][xStatus] = (regionMap[region][xStatus] as number) + 1;
          } else {
            regionMap[region]['Autre'] = (regionMap[region]['Autre'] as number) + 1;
          }
          regionMap[region].total = (regionMap[region].total as number) + 1;
      }
    });
    return Object.values(regionMap).sort((a, b) => (b.total as number) - (a.total as number));
  }, [data]);

  const getPlannedDataForDate = useCallback((targetDateStr: string) => {
    if (!targetDateStr) return [];
    const [y, m, d] = targetDateStr.split('-').map(Number);
    const targetStart = new Date(y, m - 1, d);
    targetStart.setHours(0,0,0,0);
    const targetEnd = new Date(y, m - 1, d);
    targetEnd.setHours(23,59,59,999);
    return data.filter(row => {
        const plannedDate = parseDate(row["Date de planification"]);
        return plannedDate && plannedDate >= targetStart && plannedDate <= targetEnd;
    });
  }, [data]);

  const handleChartClick = (entry: { activePayload?: { payload: { name: string }; dataKey: string }[], activeTooltipIndex?: number }, targetDateStr: string) => {
    if (!entry || !entry.activePayload) return;
    const payload = entry.activePayload[0].payload;
    const region = payload.name;
    const statusX = entry.activeTooltipIndex !== undefined ? entry.activePayload[0].dataKey : null;

    const [y, m, d] = targetDateStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    targetDate.setHours(0,0,0,0);
    const endTargetDate = new Date(y, m - 1, d);
    endTargetDate.setHours(23,59,59,999);

    const filtered = data.filter(row => {
      const creationDate = parseDate(row["Date de création du SWO"]);
      const closingDate = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
      const rowRegion = String(row["Region"] || "Non défini");
      const rowStatus = String(row["X"] || "Autre");
      if (rowRegion !== region) return false;
      if (statusX && rowStatus !== statusX && (statusX !== "Autre" || X_KEYS.includes(rowStatus as XStatus))) return false;
      const isCreated = creationDate && creationDate >= targetDate && creationDate <= endTargetDate;
      const isClosed = closingDate && closingDate >= targetDate && closingDate <= endTargetDate;
      return isCreated || isClosed;
    });
    setDrillDownData(filtered);
    setDrillDownTitle(`Production : ${region} ${statusX ? `- ${statusX}` : ''} (${toDisplayDate(targetDateStr)})`);
  };

  const leftData = useMemo(() => getChartDataForDate(dateLeft), [dateLeft, getChartDataForDate]);
  const rightData = useMemo(() => getChartDataForDate(dateRight), [dateRight, getChartDataForDate]);
  const leftPlannedData = useMemo(() => getPlannedDataForDate(dateLeft), [dateLeft, getPlannedDataForDate]);
  const rightPlannedData = useMemo(() => getPlannedDataForDate(dateRight), [dateRight, getPlannedDataForDate]);

  const handleInspectRow = (row: GlobalFileRow) => {
    onFilterChange("N° SWO", String(row["N° SWO"]));
    onSwitchToData();
    setDrillDownData(null);
  };

  const PlanList = ({ 
    items, 
    title, 
    dateStr, 
    planRef 
  }: { 
    items: GlobalFileRow[], 
    title: string, 
    dateStr: string,
    planRef?: React.RefObject<HTMLDivElement | null>
  }) => (
    <div ref={planRef} className="bg-white rounded-xl shadow-sm border flex flex-col h-[600px] overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0 gap-2">
            <h4 className="font-bold flex items-center gap-2 text-gray-800 tracking-tight">
              <ClipboardList className="w-4 h-4 text-indigo-500" /> {title}
            </h4>
            <div className="flex items-center gap-2">
              {planRef && (
                <button
                  onClick={() => shareOrDownloadElementAsPng(planRef, `Daily_Plan_${dateStr}`, `Daily Plan - ${title}`)}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-lg transition-all shadow-sm active:scale-95 flex items-center gap-1.5 text-[10px] font-black uppercase"
                  title="Exporter / Partager ce Daily Plan en format PNG"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>PNG</span>
                </button>
              )}
              <button 
                onClick={() => { setDrillDownData(items); setDrillDownTitle(`Planification : ${toDisplayDate(dateStr)}`); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-sm transition-all active:scale-95"
              >
                {items.length} PLANIFIÉS
              </button>
            </div>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-4">
            {items.length > 0 ? (
                items.map((item, idx) => {
                    const isClosed = String(item["State SWO"]).toUpperCase() === "CLOSED";
                    const priority = String(item["Priorité"] || "P4");
                    const creationDate = formatDate(item["Date de création du SWO"]);
                    return (
                      <div key={idx} onClick={() => handleInspectRow(item)} className="p-4 border rounded-2xl bg-white shadow-sm border-l-8 border-l-indigo-600 transition-all hover:shadow-md cursor-pointer group animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="flex justify-between items-start mb-3">
                              <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded border shadow-sm ${getPriorityStyle(priority)}`}>
                                        {priority}
                                    </span>
                                    <span className="font-black text-base text-slate-900 tracking-tight">{item["Nom du site"]}</span>
                                  </div>
                                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider ml-1">{item["Region"]}</span>
                              </div>
                              <span className={`text-[10px] font-black px-3 py-1 rounded-full border shadow-sm ${isClosed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                  {item["State SWO"]}
                              </span>
                          </div>
                          
                          <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700 mb-3 line-clamp-2 italic leading-relaxed font-medium">
                              {item["Description"] || item["Short description"] || "Pas de description disponible."}
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{item["Intervenant"] || "Non assigné"}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                                  <PlusCircle className="w-3 h-3" />
                                  <span>Créé le: {creationDate}</span>
                                </div>
                              </div>
                              <div className="font-mono text-slate-800 dark:text-slate-200 font-black bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs shadow-xs">
                                SWO: <span className="text-indigo-600 dark:text-indigo-400 font-black">{item["N° SWO"]}</span>
                              </div>
                          </div>
                      </div>
                    );
                })
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-300">
                  <AlertCircle className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm font-bold italic">Aucune planification pour ce jour.</p>
                </div>
            )}
        </div>
    </div>
  );

  return (
    <div ref={dailyStatusContainerRef} className="p-4 md:p-6 space-y-8 bg-gray-50 min-h-full">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-30">
         <div className="flex items-center gap-3">
           <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
             <Calendar className="w-8 h-8 text-indigo-600" />
             Daily Monitor
           </h2>
         </div>

         <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => shareOrDownloadElementAsPng(dailyStatusContainerRef, `Daily_Monitor_${dateRight}`, `Daily Monitor (${dateRight})`)}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              title="Exporter / Partager tout l'écran Daily Monitor en format PNG"
            >
              <Share2 className="w-4 h-4" />
              <span>Partager Écran (PNG)</span>
            </button>

            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-200 shadow-inner">
               <input type="date" className="border-none bg-transparent text-sm font-bold focus:ring-0 cursor-pointer" value={dateLeft} onChange={(e) => setDateLeft(e.target.value)} />
               <ArrowRightLeft className="w-5 h-5 text-gray-300" />
               <input type="date" className="border-none bg-transparent text-sm font-bold text-indigo-600 focus:ring-0 cursor-pointer" value={dateRight} onChange={(e) => setDateRight(e.target.value)} />
               <button onClick={() => setDateRight(toInputDate(new Date()))} className="p-2 hover:bg-white rounded-full transition-all text-gray-400 hover:text-indigo-600"><RefreshCw className="w-5 h-5" /></button>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
         <div className="xl:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-indigo-50 flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Zap className="w-32 h-32 text-indigo-600" />
            </div>
            <div className="flex-1 space-y-5">
               <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-indigo-500" />
                    Adhérence Planning
                  </h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{toDisplayDate(dateRight)}</p>
               </div>
               <div className="grid grid-cols-3 gap-4">
                  <div className="bg-indigo-50/50 p-5 rounded-3xl border border-indigo-100 group hover:bg-indigo-600 transition-all duration-300">
                     <p className="text-3xl font-black text-indigo-700 group-hover:text-white">{reviewStats.plannedTotal}</p>
                     <p className="text-xs font-black text-indigo-400 group-hover:text-indigo-100 uppercase tracking-wider mt-1">Total Planifiés</p>
                  </div>
                  <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 group hover:bg-emerald-600 transition-all duration-300">
                     <p className="text-3xl font-black text-emerald-700 group-hover:text-white">{reviewStats.plannedClosed}</p>
                     <p className="text-xs font-black text-emerald-400 group-hover:text-emerald-100 uppercase tracking-wider mt-1">Réalisés</p>
                  </div>
                  <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100 group hover:bg-amber-600 transition-all duration-300">
                     <p className="text-3xl font-black text-amber-700 group-hover:text-white">{reviewStats.plannedOpen}</p>
                     <p className="text-xs font-black text-amber-400 group-hover:text-amber-100 uppercase tracking-wider mt-1">En cours (Open)</p>
                  </div>
               </div>
            </div>
            <div className="w-full md:w-48 h-48 shrink-0 flex flex-col items-center justify-center relative min-h-[180px] min-w-0">
               <div className="w-full h-full relative min-h-[180px] min-w-0">
                 <ResponsiveContainer width="100%" height={180} minWidth={0} minHeight={150} debounce={50}>
                    <PieChart>
                       <Pie 
                         data={[
                           { name: 'Réalisés', value: reviewStats.plannedClosed },
                           { name: 'En cours', value: reviewStats.plannedOpen }
                         ]} 
                         innerRadius={60} 
                         outerRadius={80} 
                         paddingAngle={5} 
                         dataKey="value"
                       >
                          <Cell fill="#10b981" />
                          <Cell fill="#f1f5f9" />
                       </Pie>
                       <Tooltip />
                    </PieChart>
                 </ResponsiveContainer>
               </div>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-2xl font-black text-slate-900">{reviewStats.prodRatio}%</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase text-center leading-tight">Adhérence<br/>Planning</p>
               </div>
            </div>
         </div>

         <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-red-100 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-5">
               <div className="flex flex-col">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Review Point : Nouveaux Jaunes
                  </h3>
                  <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">(Créés cette Semaine)</span>
               </div>
               <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${reviewStats.yellowAlerts.length > 0 ? 'bg-red-600 text-white' : 'bg-emerald-500 text-white'}`}>
                  {reviewStats.yellowAlerts.length}
               </span>
            </div>

            <div className="flex-1 overflow-auto space-y-2.5 pr-1 custom-scrollbar">
               {reviewStats.yellowAlerts.length > 0 ? (
                 (reviewStats.yellowAlerts.length > 5 && !isYellowExpanded
                   ? reviewStats.yellowAlerts.slice(0, 2)
                   : reviewStats.yellowAlerts).map((alert, idx) => (
                   <div key={idx} onClick={() => handleInspectRow(alert)} className="p-4 bg-red-50/50 rounded-2xl border border-red-100 hover:bg-red-100/50 transition-all cursor-pointer group animate-in slide-in-from-right-2 duration-300">
                      <div className="flex justify-between items-center mb-1">
                         <span className="text-xs font-black text-slate-900 group-hover:text-red-700">{alert["Nom du site"]}</span>
                         <span className="font-mono font-black text-red-600 text-xs bg-white px-2.5 py-0.5 rounded border border-red-200 shadow-sm">#{alert["N° SWO"]}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {!alert["N° FIT &/ou DP"] && (
                          <p className="text-[9px] text-red-600 font-bold uppercase tracking-tighter flex items-center gap-1.5">
                            <FileWarning className="w-3 h-3" /> N° FIT &/ou DP : ABSENT
                          </p>
                        )}
                        {!alert["Commentaire"] && (
                          <p className="text-[9px] text-red-400 font-bold uppercase tracking-tighter flex items-center gap-1.5">
                            <MessageSquareOff className="w-3 h-3" /> COMMENTAIRE : VIDE
                          </p>
                        )}
                      </div>
                      <div className="mt-2 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">
                        Créé le : {formatDate(alert["Date de création du SWO"])}
                      </div>
                   </div>
                 ))
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 opacity-40">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                    <div>
                      <p className="text-xs font-black uppercase text-emerald-700">Conformité OK</p>
                      <p className="text-[10px] font-bold text-slate-400">Zéro dossier bloqué cette semaine.</p>
                    </div>
                 </div>
               )}
            </div>

            {reviewStats.yellowAlerts.length > 5 && (
              <button
                onClick={() => setIsYellowExpanded(!isYellowExpanded)}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 border border-red-100 hover:bg-red-50 bg-white rounded-xl text-xs font-black text-red-600 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
              >
                {isYellowExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4 text-red-500" />
                    <span>Réduire la liste ({reviewStats.yellowAlerts.length} SWO)</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 text-red-500" />
                    <span>Dérouler pour voir les {reviewStats.yellowAlerts.length - 2} autres SWO</span>
                  </>
                )}
              </button>
            )}

            {reviewStats.yellowAlerts.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 text-center uppercase">Audit Hebdomadaire : Saisir N° FIT/DP ou Commentaires</p>
              </div>
            )}
         </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-lg font-black text-gray-800 border-l-4 border-indigo-600 pl-4 uppercase tracking-tight flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          Production Globale (Régions)
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[450px]" ref={chartLeftRef}>
                <div className="flex justify-between items-center mb-4 border-b pb-2 shrink-0">
                  <h3 className="font-black text-gray-400 text-xs uppercase">{toDisplayDate(dateLeft)}</h3>
                  <button onClick={() => downloadChartAsJpg(chartLeftRef, 'daily_left')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"><Camera className="w-5 h-5" /></button>
                </div>
                <div className="h-[320px] w-full min-h-[320px] min-w-0 relative">
                  <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={250} debounce={50}>
                    <BarChart data={leftData} margin={{bottom: 60}} onClick={(e) => handleChartClick(e, dateLeft)} className="cursor-pointer">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} fontSize={10} tick={{fill: '#9ca3af', fontWeight: 'bold'}} />
                      <YAxis tick={{fill: '#9ca3af', fontSize: 10}} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      {X_KEYS.map(key => <Bar key={key} dataKey={key} stackId="a" fill={X_COLORS[key]} shape={<ThreeDBarVertical />} />)}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[450px]" ref={chartRightRef}>
                <div className="flex justify-between items-center mb-4 border-b pb-2 shrink-0">
                  <h3 className="font-black text-indigo-600 text-xs uppercase">{toDisplayDate(dateRight)}</h3>
                  <button onClick={() => downloadChartAsJpg(chartRightRef, 'daily_right')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"><Camera className="w-5 h-5" /></button>
                </div>
                <div className="h-[320px] w-full min-h-[320px] min-w-0 relative">
                  <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={250} debounce={50}>
                    <BarChart data={rightData} margin={{bottom: 60}} onClick={(e) => handleChartClick(e, dateRight)} className="cursor-pointer">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} fontSize={10} tick={{fill: '#9ca3af', fontWeight: 'bold'}} />
                      <YAxis tick={{fill: '#9ca3af', fontSize: 10}} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      {X_KEYS.map(key => <Bar key={key} dataKey={key} stackId="a" fill={X_COLORS[key]} shape={<ThreeDBarVertical />} />)}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
            </div>
        </div>
      </div>

      <div ref={dailyPlanSectionRef} className="space-y-6 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <h3 className="text-lg font-black text-gray-800 border-l-4 border-emerald-500 pl-4 uppercase tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-emerald-500" />
            Planification de Maintenance (Daily Plan)
          </h3>
          <button
            onClick={() => shareOrDownloadElementAsPng(dailyPlanSectionRef, `Daily_Plan_Maintenance_${dateRight}`, `Daily Plan Maintenance (${dateRight})`)}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 flex items-center gap-2 w-fit cursor-pointer"
            title="Partager tout le module Daily Plan sous format PNG"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>Partager Daily Plan (PNG)</span>
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <PlanList items={leftPlannedData} title={toDisplayDate(dateLeft)} dateStr={dateLeft} planRef={leftPlanRef} />
            <PlanList items={rightPlannedData} title={toDisplayDate(dateRight)} dateStr={dateRight} planRef={rightPlanRef} />
        </div>
      </div>

      {drillDownData && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden border border-indigo-100 animate-in zoom-in-95">
             <div className="bg-indigo-700 p-6 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                   <div className="bg-white/20 p-2 rounded-xl">
                      <ListFilter className="w-6 h-6" />
                   </div>
                   <div>
                      <h3 className="text-xl font-black">{drillDownTitle}</h3>
                      <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">{drillDownData.length} SWO trouvés</p>
                   </div>
                </div>
                <button onClick={() => setDrillDownData(null)} className="p-3 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6" /></button>
             </div>
             
             <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                   {drillDownData.map((row, idx) => {
                      const priority = String(row["Priorité"] || "P4");
                      return (
                        <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col justify-between group">
                           <div>
                              <div className="flex justify-between items-start mb-4">
                                 <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${getPriorityStyle(priority)}`}>{priority}</span>
                                 <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{row["State SWO"]}</span>
                                    <span className="text-[10px] text-gray-400 font-mono mt-1"># {row["N° SWO"]}</span>
                                 </div>
                              </div>
                              <h4 className="font-black text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">{row["Nom du site"]}</h4>
                              <p className="text-[10px] text-gray-400 font-bold uppercase mb-3 flex items-center gap-1"><MapPin className="w-3 h-3" /> {row["Region"]}</p>
                              <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl mb-4 italic line-clamp-2">
                                 {row["Description"] || "Pas de description."}
                              </div>
                           </div>
                           <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-[10px]">
                                    {String(row["Intervenant"] || "?").charAt(0)}
                                 </div>
                                 <span className="text-[10px] font-bold text-gray-500">{row["Intervenant"] || "Non assigné"}</span>
                              </div>
                              <button 
                                onClick={() => handleInspectRow(row)}
                                className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                              >
                                 <Eye className="w-5 h-5" />
                              </button>
                           </div>
                        </div>
                      )
                   })}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
