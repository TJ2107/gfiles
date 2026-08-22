
import React, { useMemo, useState, useRef } from 'react';
import { GlobalFileRow } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ComposedChart, Line 
} from 'recharts';
import { ThreeDBarVertical } from './ThreeDShapes';
import { 
  CheckCircle, AlertTriangle, Timer, Filter, Calendar, RotateCcw, 
  Camera, Eye, MapPin, AlertCircle,
  ShieldCheck, Activity, Target, ArrowRight, Hash, Download
} from 'lucide-react';
import { downloadChartAsJpg } from '../utils/chartHelpers';
import * as XLSX from 'xlsx';
import { parseDate } from '../utils/dateHelpers';

interface TTFAnalysisProps {
  data: GlobalFileRow[];
  onFilterChange?: (column: string, value: string) => void;
  onSwitchToData?: () => void;
}

const SLA_CONFIG: Record<string, number> = {
  'P0': 24,
  'P1': 48,
  'P2': 168,
  'P3': 720,
  'P4': Infinity
};

const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3', 'P4'];

const COLORS = {
  met: '#10b981',
  missed: '#f43f5e',
  volume: '#e2e8f0',
  indigo: '#4f46e5'
};

const formatDate = (date: string | number | Date | null | undefined): string => {
  const d = parseDate(date);
  if (!d) return "-";
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

export const TTFAnalysis: React.FC<TTFAnalysisProps> = ({ data, onFilterChange, onSwitchToData }) => {
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>(PRIORITY_OPTIONS);
  const [closingDateFilter, setClosingDateFilter] = useState<{start: string, end: string}>({start: '', end: ''});

  const priorityChartRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);

  const togglePriority = (p: string) => {
    setSelectedPriorities(prev => 
      prev.includes(p) ? prev.filter(item => item !== p) : [...prev, p]
    );
  };

  const analysis = useMemo(() => {
    const isRowVisible = (row: GlobalFileRow, priorityKey: string, endDate: Date | null) => {
        if (!selectedPriorities.includes(priorityKey)) return false;
        if (closingDateFilter.start || closingDateFilter.end) {
          if (!endDate) return false;
          const checkClosing = new Date(endDate);
          checkClosing.setHours(0,0,0,0);
          if (closingDateFilter.start && checkClosing < new Date(closingDateFilter.start)) return false;
          if (closingDateFilter.end && checkClosing > new Date(closingDateFilter.end)) return false;
        }
        return true;
    };

    const statsByPriority: Record<string, { priority: string, met: number, missed: number, totalDuration: number, count: number, target: number }> = {};
    const statsByMonth: Map<string, { dateObj: number, total: number, met: number, duration: number }> = new Map();
    const allOverdueItems: (GlobalFileRow & { 
      creationDateStr: string; 
      closingDateStr: string; 
      duration: number; 
      target: number; 
      excess: number; 
      priority: string; 
    })[] = [];
    
    let totalAnalyzed = 0;
    let totalMet = 0;
    let totalMissed = 0;

    PRIORITY_OPTIONS.forEach(p => {
      statsByPriority[p] = { priority: p, met: 0, missed: 0, totalDuration: 0, count: 0, target: SLA_CONFIG[p] };
    });

    data.forEach(row => {
      const priorityKey = getPriorityKey(row);
      const startDate = parseDate(row["Date de création du SWO"]);
      const endDate = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);

      if (!isRowVisible(row, priorityKey, endDate)) return;

      if (startDate && endDate && SLA_CONFIG[priorityKey] !== undefined) {
        const diffMs = endDate.getTime() - startDate.getTime();
        const durationHours = diffMs / (1000 * 60 * 60);

        if (durationHours >= 0) { 
          const targetHours = SLA_CONFIG[priorityKey];
          const isMet = durationHours <= targetHours;
          
          totalAnalyzed++;
          statsByPriority[priorityKey].count++;
          statsByPriority[priorityKey].totalDuration += durationHours;
          
          if (isMet) {
            statsByPriority[priorityKey].met++;
            totalMet++;
          } else {
            statsByPriority[priorityKey].missed++;
            totalMissed++;
            if (targetHours !== Infinity) {
              allOverdueItems.push({
                ...row,
                creationDateStr: formatDate(startDate),
                closingDateStr: formatDate(endDate),
                duration: durationHours,
                target: targetHours,
                excess: durationHours - targetHours,
                priority: priorityKey
              });
            }
          }

          const monthKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
          if (!statsByMonth.has(monthKey)) {
             statsByMonth.set(monthKey, { 
               dateObj: new Date(endDate.getFullYear(), endDate.getMonth(), 1).getTime(),
               total: 0, met: 0, duration: 0 
             });
          }
          const monthEntry = statsByMonth.get(monthKey)!;
          monthEntry.total++; 
          monthEntry.duration += durationHours;
          if (isMet) monthEntry.met++;
        }
      }
    });

    const chartData = Object.values(statsByPriority).filter(s => s.count > 0).map(s => ({
        name: s.priority, Respecté: s.met, "Non Respecté": s.missed,
        avgDuration: s.count > 0 ? (s.totalDuration / s.count).toFixed(1) : 0
    }));

    const trendData = Array.from(statsByMonth.values()).sort((a, b) => a.dateObj - b.dateObj).map(entry => ({
        name: new Date(entry.dateObj).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        "Conformité (%)": parseFloat(((entry.met / entry.total) * 100).toFixed(1)),
        "Volume": entry.total
    }));

    const complianceRate = totalAnalyzed > 0 ? Math.round((totalMet / totalAnalyzed) * 100) : 0;

    return { 
      chartData, 
      trendData, 
      top50Overdue: allOverdueItems.sort((a, b) => b.excess - a.excess).slice(0, 50),
      kpis: { totalAnalyzed, totalMet, totalMissed, complianceRate }
    };
  }, [data, selectedPriorities, closingDateFilter]);

  const KPICard = ({ title, value, icon: Icon, colorClass, subtitle }: { title: string; value: string | number; icon: React.ElementType; colorClass: string; subtitle?: string; }) => (
    <div className={`relative bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden group hover:shadow-xl transition-all duration-500`}>
      <div className="relative z-10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <h4 className={`text-4xl font-black tracking-tighter ${colorClass}`}>{value}</h4>
          {subtitle && <span className="text-xs font-bold text-slate-400">{subtitle}</span>}
        </div>
      </div>
      <div className={`absolute -right-4 -bottom-4 opacity-[0.05] group-hover:opacity-[0.08] transition-opacity duration-500`}>
        <Icon className="w-32 h-32 rotate-12" />
      </div>
      <div className={`absolute top-0 left-0 w-1.5 h-full ${colorClass.replace('text-', 'bg-')}`}></div>
    </div>
  );

  const handleInspect = (row: GlobalFileRow) => {
    if (onFilterChange && onSwitchToData) {
      onFilterChange("N° SWO", String(row["N° SWO"]));
      onSwitchToData();
    }
  };

  const exportOverdueToExcel = () => {
    const exportData = analysis.top50Overdue.map(row => ({
      "N° SWO": row["N° SWO"],
      "ID Site": row["ID"],
      "Nom du site": row["Nom du site"],
      "Région": row["Region"],
      "Priorité": row.priority,
      "Date Création": row.creationDateStr,
      "Date Clôture": row.closingDateStr,
      "Durée (Heures)": Math.floor(row.duration),
      "Objectif SLA": row.target,
      "Excès (Heures)": Math.floor(row.excess)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dossiers_Hors_Delais");
    XLSX.writeFile(wb, `TOP50_HORS_DELAIS_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-3 sm:p-6 space-y-6 sm:space-y-8 bg-gray-50 min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
           <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
             <Timer className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600 shrink-0" /> 
             SLA Adhérence & TTF
           </h2>
           <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-0.5 sm:mt-1">Analyse des délais de traitement (Time to Fix).</p>
        </div>
        <div className="flex gap-2 self-end sm:self-auto">
            <button onClick={() => setClosingDateFilter({start:'', end:''})} className="p-2 sm:p-2.5 bg-white border rounded-xl hover:bg-gray-50 text-slate-400 transition-all" title="Réinitialiser les filtres"><RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <KPICard title="SWO Analysés" value={analysis.kpis.totalAnalyzed} icon={Activity} colorClass="text-slate-900" />
        <KPICard title="Respect SLA" value={analysis.kpis.totalMet} icon={ShieldCheck} colorClass="text-emerald-600" subtitle="Dossiers" />
        <KPICard title="Hors Délais" value={analysis.kpis.totalMissed} icon={AlertTriangle} colorClass="text-rose-600" subtitle="Échecs" />
        <KPICard title="Taux de Conformité" value={`${analysis.kpis.complianceRate}%`} icon={Target} colorClass="text-indigo-600" />
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          <div className="space-y-2 sm:space-y-3">
            <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Filter className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Filtrer Priorités
            </label>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {PRIORITY_OPTIONS.map(p => (
                <button 
                  key={p} 
                  onClick={() => togglePriority(p)} 
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition-all border ${selectedPriorities.includes(p) ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3">
            <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Période de Clôture
            </label>
            <div className="flex items-center gap-2 sm:gap-3">
              <input type="date" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={closingDateFilter.start} onChange={(e) => setClosingDateFilter(p => ({...p, start: e.target.value}))} />
              <span className="text-slate-300 font-black text-xs">TO</span>
              <input type="date" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={closingDateFilter.end} onChange={(e) => setClosingDateFilter(p => ({...p, end: e.target.value}))} />
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[380px] sm:h-[450px] flex flex-col min-w-0" ref={priorityChartRef}>
          <div className="flex justify-between items-center mb-4 sm:mb-6 shrink-0">
             <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-tight">Performance par Priorité</h3>
             <button onClick={() => downloadChartAsJpg(priorityChartRef, 'respect_sla')} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><Camera className="w-4 h-4 sm:w-5 sm:h-5" /></button>
          </div>
          <div className="h-[280px] sm:h-[320px] w-full min-h-[260px] min-w-0 relative">
            <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={240} debounce={50}>
              <BarChart data={analysis.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 700}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }} />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                <Bar dataKey="Respecté" stackId="a" fill={COLORS.met} shape={<ThreeDBarVertical />} />
                <Bar dataKey="Non Respecté" stackId="a" fill={COLORS.missed} shape={<ThreeDBarVertical />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[380px] sm:h-[450px] flex flex-col min-w-0" ref={trendChartRef}>
           <div className="flex justify-between items-center mb-4 sm:mb-6 shrink-0">
              <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-tight">Tendance de Résolution</h3>
              <button onClick={() => downloadChartAsJpg(trendChartRef, 'tendance_sla')} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><Camera className="w-4 h-4 sm:w-5 sm:h-5" /></button>
           </div>
           <div className="h-[280px] sm:h-[320px] w-full min-h-[260px] min-w-0 relative">
              <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={240} debounce={50}>
                 <ComposedChart data={analysis.trendData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 700}} axisLine={false} tickLine={false} />
                   <YAxis yAxisId="left" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                   <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{fontSize: 10, fill: COLORS.met}} axisLine={false} tickLine={false} />
                   <Tooltip contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }} />
                   <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                   <Bar yAxisId="left" dataKey="Volume" fill={COLORS.volume} barSize={25} radius={[4, 4, 0, 0]} />
                   <Line yAxisId="right" type="monotone" dataKey="Conformité (%)" stroke={COLORS.met} strokeWidth={4} dot={{r: 4, fill: COLORS.met, strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                 </ComposedChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6 pb-12 sm:pb-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 border-l-4 border-rose-500 pl-3 sm:pl-4">
           <div className="flex items-center gap-2 sm:gap-3">
             <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500 shrink-0" />
             <h3 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tighter">🚨 Top 50 - Dossiers Hors Délais</h3>
           </div>
           <button 
             onClick={exportOverdueToExcel}
             className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 bg-slate-900 hover:bg-indigo-700 text-white rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-slate-200"
           >
             <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Export List
           </button>
        </div>
        
        <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider shadow-sm">
                  <th className="px-4 sm:px-6 py-3.5 sm:py-5">Ticket & ID</th>
                  <th className="px-3 sm:px-6 py-3.5 sm:py-5">Localisation Site</th>
                  <th className="px-3 sm:px-6 py-3.5 sm:py-5">Timeline Cycle</th>
                  <th className="px-3 sm:px-6 py-3.5 sm:py-5 text-center">Priorité</th>
                  <th className="px-3 sm:px-6 py-3.5 sm:py-5 text-center">Durée TTF</th>
                  <th className="px-3 sm:px-6 py-3.5 sm:py-5 text-right">Excès SLA</th>
                  <th className="px-3 sm:px-6 py-3.5 sm:py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analysis.top50Overdue.map((row, idx) => (
                  <tr key={idx} className="hover:bg-rose-50/40 transition-all group">
                    <td className="px-4 sm:px-6 py-3.5 sm:py-5">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 px-2 sm:px-2.5 py-1 rounded-lg border border-indigo-200/80 inline-block w-fit">SWO: {row["N° SWO"]}</span>
                        <div className="flex items-center gap-1.5 bg-slate-100 self-start px-2 py-0.5 rounded-md border border-slate-200">
                          <Hash className="w-3 h-3 text-slate-500" />
                          <span className="text-[10px] font-mono font-black text-slate-700">{row["ID"] || "ID Inconnu"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 leading-none">{row["Nom du site"]}</span>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase flex items-center gap-1 mt-1.5"><MapPin className="w-3 h-3 text-indigo-500" /> {row["Region"]}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Créé</span>
                          <span className="text-xs font-mono font-black text-slate-800">{row.creationDateStr}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Clos</span>
                          <span className="text-xs font-mono font-black text-slate-800">{row.closingDateStr}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 border border-rose-200 uppercase">{row.priority}</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">{Math.floor(row.duration)}h</span>
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-tight mt-0.5">Obj: {row.target}h</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <span className="text-base font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-xl border border-rose-200 inline-block">+{Math.floor(row.excess)}h</span>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <button onClick={() => handleInspect(row)} className="p-3 bg-white border border-slate-100 hover:bg-indigo-600 hover:text-white text-slate-400 rounded-2xl shadow-sm transition-all active:scale-95">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {analysis.top50Overdue.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-slate-300 italic">
                      <div className="flex flex-col items-center gap-4">
                        <CheckCircle className="w-12 h-12 opacity-10" />
                        <p className="text-sm font-bold uppercase tracking-widest">Performance Optimale : Aucun Hors Délais</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
