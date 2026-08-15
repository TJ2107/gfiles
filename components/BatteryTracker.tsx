
import React, { useMemo, useState, useEffect } from 'react';
import { GlobalFileRow } from '../types';
import { 
  Battery as BatteryIcon, Search, Filter, Calendar, MapPin, 
  Download, CalendarCheck, RotateCcw, Activity, ShieldAlert,
  Zap, Clock, Info, Save, Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseDate } from '../utils/dateHelpers';
import { saveCommentToFirebase, fetchCommentsFromFirebase } from '../firebaseData';

interface BatteryTrackerProps {
  data: GlobalFileRow[];
  thresholdMonths?: number;
}

interface SiteBatteryStatus {
  siteName: string;
  region: string;
  lastReplacementDate: Date | null;
  nextReplacementDate: Date | null;
  monthsElapsed: number;
  status: 'RED' | 'ORANGE' | 'GREEN';
  lastSWO: string;
  lastID: string;
  manualComment?: string;
}

const getMonthsDifference = (startDate: Date, endDate: Date) => {
  return (
    endDate.getMonth() -
    startDate.getMonth() +
    12 * (endDate.getFullYear() - startDate.getFullYear())
  );
};

export const BatteryTracker: React.FC<BatteryTrackerProps> = ({ data, thresholdMonths = 7 }) => {
  const EXPIRATION_THRESHOLD_MONTHS = thresholdMonths;
  const WARNING_THRESHOLD_MONTHS = Math.max(1, thresholdMonths - 1);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'RED' | 'ORANGE' | 'GREEN'>('ALL');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [manualComments, setManualComments] = useState<Record<string, string>>({});
  const [editingComment, setEditingComment] = useState<{ id: string, value: string } | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchCommentsFromFirebase()
      .then((rows: { site_id: string; category: string; comment: string }[]) => {
        const batteryComments = rows
          .filter(r => r.category === 'battery')
          .reduce((acc, curr) => {
            acc[curr.site_id] = curr.comment;
            return acc;
          }, {} as Record<string, string>);
        setManualComments(batteryComments);
      })
      .catch(err => console.error('Error fetching comments:', err));
  }, []);

  const handleSaveComment = async (siteId: string) => {
    if (!editingComment || editingComment.id !== siteId) return;
    
    setIsSaving(siteId);
    try {
      await saveCommentToFirebase(siteId, 'battery', editingComment.value);
      setManualComments(prev => ({ ...prev, [siteId]: editingComment.value }));
      setEditingComment(null);
    } catch (err) {
      console.error('Error saving comment:', err);
    } finally {
      setIsSaving(null);
    }
  };

  const batteryData = useMemo(() => {
    const sitesMap: Record<string, GlobalFileRow[]> = {};
    const now = new Date();

    data.forEach(row => {
      const desc = String(row["Description"] || "").toLowerCase();
      const siteId = String(row["ID"] || "Inconnu").trim().toUpperCase();
      const status = String(row["State SWO"] || row["status"] || "").toUpperCase();
      
      // Strict search for battery replacements based on user request
      const keywords = [
        "swap battery ge", 
        "remplacement batterie ge", 
        "remplacement battery ge"
      ];

      const isBatteryTask = keywords.some(k => desc.includes(k));
      const isClosed = status === "CLOSED";

      if (isBatteryTask && isClosed) {
        if (!sitesMap[siteId]) sitesMap[siteId] = [];
        sitesMap[siteId].push(row);
      }
    });

    const results: SiteBatteryStatus[] = Object.entries(sitesMap).map(([siteId, rows]) => {
      let latestDate: Date | null = null;
      let lastSWO = "N/A";
      let lastID = siteId;
      let siteName = "Inconnu";
      let region = "Inconnu";

      rows.forEach(r => {
        const date = parseDate(r["Closing date"]) || parseDate(r["Date de Clôture"]);
        if (date && (!latestDate || date > latestDate)) {
          latestDate = date;
          lastSWO = String(r["N° SWO"] || "N/A");
          lastID = String(r["ID"] || siteId);
          siteName = String(r["Nom du site"] || "Inconnu");
          region = String(r["Region"] || "Inconnu");
        }
      });

      let monthsElapsed = 0;
      let status: 'RED' | 'ORANGE' | 'GREEN' = 'GREEN';
      let nextReplacementDate: Date | null = null;

      if (latestDate) {
        monthsElapsed = getMonthsDifference(latestDate, now);
        if (monthsElapsed >= EXPIRATION_THRESHOLD_MONTHS) status = 'RED';
        else if (monthsElapsed >= WARNING_THRESHOLD_MONTHS) status = 'ORANGE';
        else status = 'GREEN';

        nextReplacementDate = new Date(latestDate);
        nextReplacementDate.setMonth(nextReplacementDate.getMonth() + EXPIRATION_THRESHOLD_MONTHS);
      }

      return { 
        siteName, 
        region, 
        lastReplacementDate: latestDate, 
        nextReplacementDate, 
        monthsElapsed, 
        status, 
        lastSWO, 
        lastID,
        manualComment: manualComments[siteId] || ""
      };
    });

    return results
      .filter(r => r.lastReplacementDate !== null)
      .sort((a, b) => b.monthsElapsed - a.monthsElapsed);
  }, [data, manualComments, EXPIRATION_THRESHOLD_MONTHS, WARNING_THRESHOLD_MONTHS]);

  const filteredResults = useMemo(() => {
    return batteryData.filter(item => {
      const matchesSearch = item.siteName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           item.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.lastID.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || item.status === filterStatus;
      let matchesDate = true;
      if (item.lastReplacementDate) {
        const itemTime = item.lastReplacementDate.getTime();
        if (dateRange.start) {
          const startTime = new Date(dateRange.start).setHours(0, 0, 0, 0);
          if (itemTime < startTime) matchesDate = false;
        }
        if (dateRange.end) {
          const endTime = new Date(dateRange.end).setHours(23, 59, 59, 999);
          if (itemTime > endTime) matchesDate = false;
        }
      } else if (dateRange.start || dateRange.end) matchesDate = false;
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [batteryData, searchTerm, filterStatus, dateRange]);

  const stats = useMemo(() => {
    const total = batteryData.length;
    const green = batteryData.filter(d => d.status === 'GREEN').length;
    const orange = batteryData.filter(d => d.status === 'ORANGE').length;
    const red = batteryData.filter(d => d.status === 'RED').length;
    const complianceRate = total > 0 ? Math.round((green / total) * 100) : 100;
    return { total, red, orange, green, complianceRate };
  }, [batteryData]);

  const exportToExcel = () => {
    const exportData = filteredResults.map(item => ({
      "ID": item.lastID,
      "Statut": item.status === 'RED' ? 'EXPIRÉ' : item.status === 'ORANGE' ? 'À PRÉVOIR' : 'CONFORME',
      "Nom du site": item.siteName,
      "Région": item.region,
      "Dernier Remplacement": item.lastReplacementDate?.toLocaleDateString('fr-FR'),
      "Âge (Mois)": item.monthsElapsed,
      "Dernier SWO": item.lastSWO
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Batteries");
    XLSX.writeFile(wb, `BATTERY_HEALTH_REPORT_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  /**
   * Nouveau composant de Pile Dynamique
   */
  const BatteryStack = ({ months, status }: { months: number, status: string }) => {
    // 7 mois = 100% utilisé (pile vide)
    // On calcule le reste (Santé) : (7 - mois) / 7
    const remainingRatio = Math.max(0, (EXPIRATION_THRESHOLD_MONTHS - months) / EXPIRATION_THRESHOLD_MONTHS);
    const percentage = remainingRatio * 100;
    
    let colorClass = "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]";
    if (status === 'ORANGE') colorClass = "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]";
    if (status === 'RED') colorClass = "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)] animate-pulse";

    return (
      <div className="relative flex flex-col items-center gap-1 group/stack">
        <div className="w-14 h-8 border-2 border-slate-200 rounded-md p-0.5 relative flex items-center bg-white shadow-inner overflow-hidden">
          {/* Le corps de la pile */}
          <div 
            className={`h-full rounded-sm transition-all duration-1000 ease-out ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
          {/* Reflet brillant pour effet premium */}
          <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20"></div>
          
          {/* Segments décoratifs */}
          <div className="absolute inset-0 flex justify-evenly pointer-events-none opacity-20">
             <div className="w-px h-full bg-slate-300"></div>
             <div className="w-px h-full bg-slate-300"></div>
             <div className="w-px h-full bg-slate-300"></div>
          </div>
        </div>
        {/* Le petit bout de la pile */}
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-3 bg-slate-200 rounded-r-sm"></div>
        <span className="text-[9px] font-black text-slate-400 mt-0.5">{Math.round(percentage)}%</span>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-8 bg-[#F8FAFC] min-h-full font-sans">
      {/* HEADER CRITIQUE */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6 bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="bg-indigo-600 p-3 sm:p-5 rounded-xl sm:rounded-[2rem] shadow-xl shadow-indigo-100 shrink-0">
            <BatteryIcon className="w-6 h-6 sm:w-10 sm:h-10 text-white" />
          </div>
          <div>
            <h2 className="text-lg sm:text-3xl font-black text-slate-900 tracking-tighter uppercase">
              DG Battery <span className="text-indigo-600">Life-Cycle</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
              <span className="bg-emerald-100 text-emerald-700 text-[9px] sm:text-[10px] font-black px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full uppercase tracking-wider">Seuil: {EXPIRATION_THRESHOLD_MONTHS} Mois</span>
              <div className="hidden sm:block h-1 w-1 rounded-full bg-slate-300"></div>
              <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-tight">Monitoring d'intégrité énergétique</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between sm:justify-start">
          <div className="bg-slate-50 px-4 py-2 sm:px-8 sm:py-4 rounded-xl sm:rounded-[2rem] border border-slate-100 flex flex-col items-center">
            <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Health Score</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl sm:text-4xl font-black tracking-tighter ${stats.complianceRate < 70 ? 'text-rose-600' : 'text-emerald-600'}`}>{stats.complianceRate}%</span>
            </div>
          </div>
          <button 
            onClick={exportToExcel}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 sm:gap-3 px-4 py-3 sm:px-8 sm:py-5 bg-slate-900 hover:bg-indigo-700 text-white rounded-xl sm:rounded-[1.8rem] font-black text-xs sm:text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Export Audit</span>
          </button>
        </div>
      </div>

      {/* KPI DASHBOARD */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
        {[
          { label: 'Parc Total', value: stats.total, icon: Zap, color: 'text-slate-900', bg: 'bg-white' },
          { label: 'Expirées (Critical)', value: stats.red, icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-50/50', border: 'border-rose-100' },
          { label: 'À Prévoir (Warning)', value: stats.orange, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50/50', border: 'border-amber-100' },
          { label: 'Conformes (Active)', value: stats.green, icon: ShieldAlert, color: 'text-emerald-600', bg: 'bg-emerald-50/50', border: 'border-emerald-100' }
        ].map((kpi, i) => (
          <div key={i} className={`${kpi.bg} p-3.5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border ${kpi.border || 'border-slate-100'} group hover:shadow-xl transition-all duration-300`}>
            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tight sm:tracking-widest mb-1 sm:mb-2 truncate">{kpi.label}</p>
            <div className="flex justify-between items-end">
              <h4 className={`text-2xl sm:text-5xl font-black tracking-tighter ${kpi.color}`}>{kpi.value}</h4>
              <div className={`${kpi.color} opacity-20 group-hover:opacity-100 transition-opacity`}>
                <kpi.icon className="w-5 h-5 sm:w-10 sm:h-10" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FILTRES MODERNES */}
      <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-sm border border-slate-100 space-y-4 sm:space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 items-stretch lg:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 px-1">
              <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Rechercher un Site ou ID
            </label>
            <input 
              type="text" 
              placeholder="Ex: BRAZZA-01..." 
              className="w-full bg-slate-50 border-none rounded-xl sm:rounded-[1.5rem] px-4 py-2.5 sm:px-6 sm:py-4 text-xs sm:text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 w-full lg:w-auto">
            <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 px-1">
              <Filter className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Statut Diagnostic
            </label>
            <div className="flex bg-slate-50 p-1 sm:p-1.5 rounded-xl sm:rounded-[1.5rem] border border-slate-100 overflow-x-auto">
              {['ALL', 'RED', 'ORANGE', 'GREEN'].map((s) => (
                <button 
                  key={s} 
                  onClick={() => setFilterStatus(s as 'ALL' | 'RED' | 'ORANGE' | 'GREEN')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 sm:px-6 sm:py-2.5 rounded-lg sm:rounded-2xl text-[9px] sm:text-[10px] font-black transition-all whitespace-nowrap ${filterStatus === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {s === 'ALL' ? 'TOUT' : s === 'RED' ? 'EXPIRÉ' : s === 'ORANGE' ? 'ALERTE' : 'OK'}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={() => { setSearchTerm(''); setFilterStatus('ALL'); setDateRange({start:'', end:''}); }}
            className="p-2.5 sm:p-4 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-xl sm:rounded-2xl border border-slate-100 transition-all self-end"
            title="Réinitialiser"
          >
            <RotateCcw className="w-4 h-4 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* TABLEAU DE SANTÉ */}
      <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-md border border-slate-200 overflow-hidden mb-12 sm:mb-20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider shadow-sm">
                <th className="px-4 py-4 sm:px-8 sm:py-5">Visualisation Santé</th>
                <th className="px-3 py-4 sm:px-6 sm:py-5">Identifiant</th>
                <th className="px-3 py-4 sm:px-6 sm:py-5">Localisation (Site)</th>
                <th className="px-3 py-4 sm:px-6 sm:py-5">Dernier Swap</th>
                <th className="px-3 py-4 sm:px-6 sm:py-5">Prochaine Échéance</th>
                <th className="px-3 py-4 sm:px-6 sm:py-5 text-center">Âge Actuel</th>
                <th className="px-3 py-4 sm:px-6 sm:py-5">Commentaire Manuel</th>
                <th className="px-4 py-4 sm:px-8 sm:py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredResults.map((item, idx) => (
                <tr key={idx} className="hover:bg-indigo-50/30 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-6">
                      <BatteryStack months={item.monthsElapsed} status={item.status} />
                      <div className="flex flex-col">
                        <span className={`text-[9px] font-black uppercase tracking-tighter ${item.status === 'RED' ? 'text-rose-600' : item.status === 'ORANGE' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {item.status === 'RED' ? 'Remplacez Immédiatement' : item.status === 'ORANGE' ? 'Vigilance Recommandée' : 'État de Santé Optimal'}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">Monitoring Énergétique</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                     <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm uppercase tracking-wider">
                       {item.lastID}
                     </span>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {item.siteName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase ml-5">{item.region}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-slate-600">
                    <div className="flex flex-col">
                      <span className="text-xs font-black flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 opacity-40" />
                        {item.lastReplacementDate?.toLocaleDateString('fr-FR')}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 ml-5.5">SWO: {item.lastSWO}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className={`text-xs font-black flex items-center gap-2 ${item.status === 'RED' ? 'text-rose-600' : 'text-indigo-600'}`}>
                       <CalendarCheck className="w-3.5 h-3.5 opacity-50" />
                       {item.nextReplacementDate?.toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                       <span className={`text-2xl font-black ${item.status === 'RED' ? 'text-rose-600' : 'text-slate-800'}`}>{item.monthsElapsed}</span>
                       <span className="text-[10px] font-bold text-slate-300 uppercase">Mois</span>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-2 min-w-[200px]">
                      <div className="relative flex-1">
                        <textarea 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none h-12"
                          placeholder="Ajouter une note..."
                          value={editingComment?.id === item.lastID ? editingComment.value : (manualComments[item.lastID] || "")}
                          onChange={(e) => setEditingComment({ id: item.lastID, value: e.target.value })}
                        />
                        {editingComment?.id === item.lastID && (
                          <div className="absolute right-2 bottom-2 flex gap-1">
                            <button 
                              onClick={() => handleSaveComment(item.lastID)}
                              disabled={isSaving === item.lastID}
                              className="p-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                              {isSaving === item.lastID ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-slate-100 p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors cursor-help">
                        <Info className="w-4 h-4" />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredResults.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-32 text-center text-slate-300 italic">
                    <div className="flex flex-col items-center gap-4">
                      <Activity className="w-16 h-16 opacity-10" />
                      <p className="text-sm font-bold uppercase tracking-widest">Aucune donnée batterie détectée</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER IMPORTANCE */}
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <h4 className="text-xl font-black uppercase tracking-tight italic">Protocole de Maintenance Préventive</h4>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
            Le remplacement systématique des batteries GE tous les 7 mois garantit la continuité de service des sites critiques et prévient les pannes d'énergie lors des coupures réseau.
          </p>
        </div>
        <div className="relative z-10 flex gap-10">
           <div className="text-center">
              <p className="text-3xl font-black text-rose-500">{stats.red}</p>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Urgent Actions</p>
           </div>
           <div className="text-center">
              <p className="text-3xl font-black text-indigo-400">{stats.green}</p>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Safe Assets</p>
           </div>
        </div>
        <div className="absolute -left-10 -bottom-10 opacity-5">
           <Zap className="w-64 h-64" />
        </div>
      </div>
    </div>
  );
};
