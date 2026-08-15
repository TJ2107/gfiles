
import React, { useMemo, useState, useRef } from 'react';
import { GlobalFileRow } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { ThreeDBarHorizontal } from './ThreeDShapes';
import { 
  ClipboardList, Activity, Calendar, Camera, 
  MapPin, Hash, Tag, Layers, ListFilter, CheckCircle2,
  User, Search, ChevronRight, Globe, ArrowRight
} from 'lucide-react';
import { downloadChartAsJpg } from '../utils/chartHelpers';
import { parseDate } from '../utils/dateHelpers';

interface TASAnalysisProps {
  data: GlobalFileRow[];
  onFilterChange: (column: string, value: string) => void;
  onSwitchToData: () => void;
}

const COLORS = [
  '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#64748b'
];

const formatDate = (date: string | number | Date | null | undefined): string => {
  const d = parseDate(date);
  if (!d) return "-";
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const TASAnalysis: React.FC<TASAnalysisProps> = ({ data, onFilterChange, onSwitchToData }) => {
  const [period, setPeriod] = useState<{start: string, end: string}>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: formatDateStr(start), end: formatDateStr(end) };
  });

  const [searchTerm, setSearchTerm] = useState("");
  

  const distributionChartRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => {
    const startDate = period.start ? new Date(period.start) : null;
    const endDate = period.end ? new Date(period.end) : null;
    if (startDate) startDate.setHours(0,0,0,0);
    if (endDate) endDate.setHours(23,59,59,999);

    const statusCounts: Record<string, number> = {};
    const regionTasMap: Record<string, Record<string, number>> = {};
    const closedList: GlobalFileRow[] = [];
    let totalWithTas = 0;
    let totalAnalyzed = 0;

    data.forEach(row => {
      const closingDate = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
      
      if (!closingDate || !startDate || !endDate) return;

      if (closingDate >= startDate && closingDate <= endDate) {
        totalAnalyzed++;
        closedList.push(row);
        const tasRaw = String(row["TAS Status"] || "NON DÉFINI").trim().toUpperCase();
        const region = String(row["Region"] || "INCONNUE").trim().toUpperCase();

        if (tasRaw !== "N/A" && tasRaw !== "NON DÉFINI") {
          totalWithTas++;
          statusCounts[tasRaw] = (statusCounts[tasRaw] || 0) + 1;
        }

        if (!regionTasMap[region]) regionTasMap[region] = {};
        regionTasMap[region][tasRaw] = (regionTasMap[region][tasRaw] || 0) + 1;
      }
    });

    const distributionData = Object.entries(statusCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const uniqueStatuses = Array.from(new Set(Object.values(regionTasMap).flatMap(m => Object.keys(m)))).sort();

    const topStatus = distributionData[0]?.name || "N/A";
    const tasRate = totalAnalyzed > 0 ? Math.round((totalWithTas / totalAnalyzed) * 100) : 0;

    return { distributionData, totalWithTas, totalAnalyzed, topStatus, tasRate, closedList, regionTasMap, uniqueStatuses };
  }, [data, period]);

  const filteredClosedList = useMemo(() => {
    if (!searchTerm) return stats.closedList;
    const lowerSearch = searchTerm.toLowerCase();
    return stats.closedList.filter(row => 
      String(row["Nom du site"] || "").toLowerCase().includes(lowerSearch) ||
      String(row["N° SWO"] || "").toLowerCase().includes(lowerSearch) ||
      String(row["ID"] || "").toLowerCase().includes(lowerSearch) ||
      String(row["Intervenant"] || "").toLowerCase().includes(lowerSearch)
    );
  }, [stats.closedList, searchTerm]);

  // FONCTION DE REDIRECTION VERS ROW DATA
  const handleJumpToData = (filterType: 'TAS Status' | 'Region', value: string) => {
    onFilterChange(filterType, value);
    // On applique aussi la période pour rester cohérent avec l'analyse
    if (period.start || period.end) {
      onFilterChange("Closing date", `DATE_RANGE|${period.start}|${period.end}`);
    }
    onSwitchToData();
  };

  const handleInspectRow = (row: GlobalFileRow) => {
    onFilterChange("N° SWO", String(row["N° SWO"]));
    onSwitchToData();
    setDrillDownData(null);
  };

  return (
    <div className="p-6 lg:p-10 space-y-8 bg-[#F8FAFC] min-h-full font-sans animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-6">
          <div className="bg-indigo-600 p-5 rounded-[2rem] shadow-xl shadow-indigo-100">
            <ClipboardList className="w-10 h-10 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
              TAS <span className="text-indigo-600">Commander</span>
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3" /> Focus : SWO Clôturés
              </span>
              <div className="h-1 w-1 rounded-full bg-slate-300"></div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-tight">Analyse administrative sur Closing Date</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-[2rem] border border-slate-100 shadow-inner w-full lg:w-auto">
           <Calendar className="w-5 h-5 text-indigo-500 shrink-0" />
           <div className="flex flex-col">
             <span className="text-[8px] font-black text-slate-400 uppercase ml-1">Période de Clôture</span>
             <div className="flex items-center gap-2">
               <input type="date" className="bg-transparent border-none text-[11px] font-black focus:ring-0 outline-none w-32" value={period.start} onChange={(e) => setPeriod(p => ({ ...p, start: e.target.value }))} />
               <span className="text-slate-300 font-black">/</span>
               <input type="date" className="bg-transparent border-none text-[11px] font-black focus:ring-0 outline-none w-32 text-indigo-600" value={period.end} onChange={(e) => setPeriod(p => ({ ...p, end: e.target.value }))} />
             </div>
           </div>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'SWO Clôturés', value: stats.totalAnalyzed, icon: Hash, color: 'text-slate-900', bg: 'bg-white' },
          { label: 'Clos avec Statut TAS', value: stats.totalWithTas, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50/30' },
          { label: 'Taux Renseignement', value: `${stats.tasRate}%`, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50/30' },
          { label: 'Statut Majoritaire', value: stats.topStatus, icon: Tag, color: 'text-amber-600', bg: 'bg-amber-50/30', isText: true }
        ].map((kpi, i) => (
          <div key={i} className={`${kpi.bg} p-8 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:shadow-xl transition-all duration-500`}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{kpi.label}</p>
            <div className="flex justify-between items-end">
              <h4 className={`${kpi.isText ? 'text-xl' : 'text-4xl'} font-black tracking-tighter ${kpi.color} line-clamp-1`}>{kpi.value}</h4>
              <kpi.icon className={`w-10 h-10 ${kpi.color} opacity-20 group-hover:opacity-100 transition-opacity`} />
            </div>
          </div>
        ))}
      </div>

      {/* MAIN ANALYTICS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* DISTRIBUTION CHART - INTERACTIF */}
        <div className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-slate-100 h-[500px] flex flex-col group hover:shadow-xl transition-all duration-300" ref={distributionChartRef}>
          <div className="flex justify-between items-center mb-8 shrink-0">
             <div className="flex flex-col">
               <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3 italic">
                 <ListFilter className="w-5 h-5 text-indigo-500" />
                 Volumes par Statut TAS
               </h3>
               <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Cliquez sur une barre pour filtrer la table</p>
             </div>
             <button onClick={() => downloadChartAsJpg(distributionChartRef, 'tas_distribution_closed')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all shadow-sm"><Camera className="w-5 h-5" /></button>
          </div>
          <div className="h-[350px] w-full relative">
            <ResponsiveContainer width="99%" height={350}>
              <BarChart 
                data={stats.distributionData} 
                layout="vertical" 
                onClick={(d) => d?.activePayload && handleJumpToData('TAS Status', d.activePayload[0].payload.name)}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={140} fontSize={9} tick={{fontWeight: 800, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" barSize={30} shape={<ThreeDBarHorizontal />}>
                  {stats.distributionData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* STATUT TAS PAR ZONE TABLE - INTERACTIF */}
        <div className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[500px] group hover:shadow-xl transition-all duration-300">
          <div className="mb-6 flex justify-between items-center shrink-0">
            <div className="flex flex-col">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3 italic">
                <Globe className="w-5 h-5 text-indigo-600" />
                Répartition par Zone
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Cliquez sur une région pour voir ses dossiers</p>
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50 px-3 py-1 rounded-full border border-slate-100">ZONE FEED</span>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                  <th className="px-6 py-4 sticky left-0 bg-slate-900 z-10 border-b border-slate-800">Zone / Région</th>
                  {stats.uniqueStatuses.map(status => (
                    <th key={status} className="px-4 py-4 text-center border-b border-slate-800 min-w-[100px]">{status}</th>
                  ))}
                  <th className="px-6 py-4 text-center border-b border-slate-800 bg-slate-800">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(stats.regionTasMap).sort((a,b) => a[0].localeCompare(b[0])).map(([region, tasMap]) => {
                  const regionTotal = Object.values(tasMap).reduce((acc, curr) => acc + curr, 0);
                  return (
                    <tr 
                      key={region} 
                      className="hover:bg-indigo-50/50 transition-colors group cursor-pointer"
                      onClick={() => handleJumpToData('Region', region)}
                    >
                      <td className="px-6 py-4 font-black text-slate-700 text-[10px] uppercase sticky left-0 bg-white z-10 group-hover:bg-indigo-50 transition-colors border-r border-slate-50">{region}</td>
                      {stats.uniqueStatuses.map(status => (
                        <td key={status} className="px-4 py-4 text-center text-[11px] font-bold text-slate-500">
                          {tasMap[status] || <span className="text-slate-200">-</span>}
                        </td>
                      ))}
                      <td className="px-6 py-4 text-center text-[11px] font-black text-indigo-700 bg-indigo-50/20">{regionTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 sticky bottom-0 z-10">
                <tr className="font-black text-slate-900 text-[10px] uppercase">
                  <td className="px-6 py-4 border-t border-slate-200 bg-slate-50">TOTAL CONSOLIDÉ</td>
                  {stats.uniqueStatuses.map(status => {
                    const totalForStatus = Object.values(stats.regionTasMap).reduce((acc, curr) => acc + (curr[status] || 0), 0);
                    return <td key={status} className="px-4 py-4 text-center border-t border-slate-200 text-indigo-600 bg-slate-50">{totalForStatus}</td>;
                  })}
                  <td className="px-6 py-4 text-center bg-indigo-600 text-white border-t border-indigo-600">{stats.totalAnalyzed}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* DETAILED LIST SECTION */}
      <div className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-300">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 p-3 rounded-2xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Registre des SWO Clos</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Cliquez sur un dossier pour l'inspecter</p>
            </div>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher (Site, SWO...)" 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-[11px] font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider shadow-sm">
                <th className="px-8 py-5">Identifiant</th>
                <th className="px-6 py-5">Site & Localisation</th>
                <th className="px-6 py-5">N° SWO</th>
                <th className="px-6 py-5 max-w-xs">Description</th>
                <th className="px-6 py-5">Intervenant</th>
                <th className="px-6 py-5 whitespace-nowrap">Timeline</th>
                <th className="px-8 py-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClosedList.length > 0 ? (
                filteredClosedList.map((row, idx) => (
                  <tr 
                    key={idx} 
                    className="hover:bg-indigo-50/40 transition-all group cursor-pointer"
                    onClick={() => handleInspectRow(row)}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-xs font-mono font-black text-slate-700 uppercase">{row["ID"] || "N/A"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase leading-tight">{row["Nom du site"]}</span>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase mt-1 flex items-center gap-1.5"><MapPin className="w-3 h-3 text-indigo-500" /> {row["Region"]}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/80 inline-block">
                        {row["N° SWO"]}
                      </span>
                    </td>
                    <td className="px-6 py-5 max-w-xs">
                      <p className="text-[11px] text-slate-600 font-medium line-clamp-2 leading-relaxed italic">
                        {row["Description"] || row["Short description"] || "Pas de description."}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                          <User className="w-3.5 h-3.5 text-indigo-500" />
                        </div>
                        <span className="text-[10px] font-black text-slate-700 uppercase">{row["Intervenant"] || "Non assigné"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Créé</span>
                           <span className="text-[10px] font-black text-slate-500 whitespace-nowrap">{formatDate(row["Date de création du SWO"])}</span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-slate-200" />
                        <div className="flex flex-col">
                           <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Clos</span>
                           <span className="text-[11px] font-black text-slate-800 whitespace-nowrap">{formatDate(row["Closing date"] || row["Date de Clôture"])}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="p-3 bg-white border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white text-slate-300 rounded-xl shadow-sm transition-all">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center text-slate-300 italic opacity-30">
                    <Search className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">Aucun dossier trouvé</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER INFO */}
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <h4 className="text-xl font-black uppercase tracking-tight italic">Performance Administrative des SWO Clôturés</h4>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed font-medium">
            Naviguez entre l'analyse et les données brutes : cliquez sur n'importe quel élément visuel pour isoler les dossiers correspondants dans la base globale.
          </p>
        </div>
        <div className="relative z-10">
           <div className="bg-indigo-600/20 px-8 py-5 rounded-[2rem] border border-indigo-500/30 backdrop-blur-md">
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">Période Active</span>
              <p className="text-xl font-black text-white mt-1">{stats.totalAnalyzed} SWO Clos Analysés</p>
           </div>
        </div>
        <div className="absolute -left-10 -bottom-10 opacity-10">
           <ClipboardList className="w-64 h-64" />
        </div>
      </div>
    </div>
  );
};
