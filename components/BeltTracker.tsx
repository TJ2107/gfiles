
import React, { useMemo, useState, useEffect } from 'react';
import { GlobalFileRow } from '../types';
import { 
  Settings2, Search, Filter, Calendar, MapPin, 
  Download, CalendarCheck, RotateCcw, Clock, Activity, 
  ShieldCheck, Zap, Info, AlertTriangle, Cpu, Save, Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseDate } from '../utils/dateHelpers';
import { saveCommentToFirebase, fetchCommentsFromFirebase } from '../firebaseData';

interface BeltTrackerProps {
  data: GlobalFileRow[];
  thresholdDays?: number;
}

interface SiteBeltStatus {
  siteName: string;
  region: string;
  lastReplacementDate: Date | null;
  nextReplacementDate: Date | null;
  daysElapsed: number;
  estimatedHours: number;
  status: 'RED' | 'ORANGE' | 'GREEN';
  lastSWO: string;
  lastID: string;
  manualComment?: string;
}

export const BeltTracker: React.FC<BeltTrackerProps> = ({ data, thresholdDays = 180 }) => {
  const EXPIRATION_THRESHOLD_DAYS = thresholdDays;
  const WARNING_THRESHOLD_DAYS = Math.max(1, thresholdDays - 30);
  const HOURS_PER_DAY_ESTIMATE = 5.5;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'RED' | 'ORANGE' | 'GREEN'>('ALL');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [manualComments, setManualComments] = useState<Record<string, string>>({});
  const [editingComment, setEditingComment] = useState<{ id: string, value: string } | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchCommentsFromFirebase()
      .then((rows: { site_id: string; category: string; comment: string }[]) => {
        const beltComments = rows
          .filter(r => r.category === 'belt')
          .reduce((acc, curr) => {
            acc[curr.site_id] = curr.comment;
            return acc;
          }, {} as Record<string, string>);
        setManualComments(beltComments);
      })
      .catch(err => console.error('Error fetching comments:', err));
  }, []);

  const handleSaveComment = async (siteId: string) => {
    if (!editingComment || editingComment.id !== siteId) return;
    
    setIsSaving(siteId);
    try {
      await saveCommentToFirebase(siteId, 'belt', editingComment.value);
      setManualComments(prev => ({ ...prev, [siteId]: editingComment.value }));
      setEditingComment(null);
    } catch (err) {
      console.error('Error saving comment:', err);
    } finally {
      setIsSaving(null);
    }
  };

  const beltData = useMemo(() => {
    const sitesMap: Record<string, GlobalFileRow[]> = {};
    const now = new Date();

    data.forEach(row => {
      const desc = String(row["Description"] || "").toLowerCase();
      const siteId = String(row["ID"] || "Inconnu").trim().toUpperCase();
      
      const isBeltTask = desc.includes("courroie") || desc.includes("belt") || desc.includes("swap courroie") || desc.includes("remplacement courroie");

      if (isBeltTask) {
        if (!sitesMap[siteId]) sitesMap[siteId] = [];
        sitesMap[siteId].push(row);
      }
    });

    const results: SiteBeltStatus[] = Object.entries(sitesMap).map(([siteId, rows]) => {
      let latestDate: Date | null = null;
      let selectedRow: GlobalFileRow | null = null;

      rows.forEach(r => {
        const date = parseDate(r["Closing date"]) || parseDate(r["Date de Clôture"]);
        if (date && (!latestDate || date > latestDate)) {
          latestDate = date;
          selectedRow = r;
        }
      });

      if (!latestDate || !selectedRow) return null;

      const diffMs = now.getTime() - latestDate.getTime();
      const daysElapsed = Math.max(0, Math.floor(diffMs / (1000 * 3600 * 24)));
      const estimatedHours = Math.floor(daysElapsed * HOURS_PER_DAY_ESTIMATE);

      let status: 'RED' | 'ORANGE' | 'GREEN' = 'GREEN';
      if (daysElapsed >= EXPIRATION_THRESHOLD_DAYS) status = 'RED';
      else if (daysElapsed >= WARNING_THRESHOLD_DAYS) status = 'ORANGE';

      const nextReplacementDate = new Date(latestDate);
      nextReplacementDate.setDate(nextReplacementDate.getDate() + EXPIRATION_THRESHOLD_DAYS);

      return { 
        siteName: String(selectedRow["Nom du site"] || "Inconnu"), 
        region: String(selectedRow["Region"] || "Inconnu"), 
        lastReplacementDate: latestDate, 
        nextReplacementDate, 
        daysElapsed, 
        estimatedHours, 
        status, 
        lastSWO: String(selectedRow["N° SWO"] || "N/A"), 
        lastID: String(selectedRow["ID"] || siteId),
        manualComment: manualComments[siteId] || ""
      };
    }).filter((r): r is SiteBeltStatus => r !== null);

    return results.sort((a, b) => b.daysElapsed - a.daysElapsed);
  }, [data, manualComments, EXPIRATION_THRESHOLD_DAYS, WARNING_THRESHOLD_DAYS]);

  const filteredResults = useMemo(() => {
    return beltData.filter(item => {
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
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [beltData, searchTerm, filterStatus, dateRange]);

  const stats = useMemo(() => {
    const total = beltData.length;
    const red = beltData.filter(d => d.status === 'RED').length;
    const orange = beltData.filter(d => d.status === 'ORANGE').length;
    const green = beltData.filter(d => d.status === 'GREEN').length;
    const complianceRate = total > 0 ? Math.round((green / total) * 100) : 100;
    return { total, red, orange, green, complianceRate };
  }, [beltData]);

  const exportToExcel = () => {
    const exportData = filteredResults.map(item => ({
      "ID": item.lastID,
      "Statut Diagnostic": item.status === 'RED' ? 'CRITIQUE (>1000h)' : item.status === 'ORANGE' ? 'VIGILANCE (>850h)' : 'CONFORME',
      "Nom du site": item.siteName,
      "Région": item.region,
      "Dernière Maintenance": item.lastReplacementDate?.toLocaleDateString('fr-FR'),
      "Prochain Changement Estimé": item.nextReplacementDate?.toLocaleDateString('fr-FR'),
      "Jours Écoulés": item.daysElapsed,
      "Heures Moteur (Est.)": item.estimatedHours,
      "Dernier SWO associé": item.lastSWO
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit_Courroies_Uniques");
    XLSX.writeFile(wb, `AUDIT_COURROIES_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const BeltStack = ({ days, status }: { days: number, status: string }) => {
    const remainingRatio = Math.max(0, (EXPIRATION_THRESHOLD_DAYS - days) / EXPIRATION_THRESHOLD_DAYS);
    const percentage = Math.round(remainingRatio * 100);
    
    let colorClass = "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]";
    if (status === 'ORANGE') colorClass = "bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]";
    if (status === 'RED') colorClass = "bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse";

    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-16 h-8 border-2 border-slate-200 rounded-lg p-0.5 relative flex items-center bg-white shadow-inner">
          <div 
            className={`h-full rounded-[4px] transition-all duration-1000 ease-out ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
          <div className="absolute top-0 left-0 w-full h-1/2 bg-white/20 rounded-t-lg"></div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-black text-slate-400">{percentage}%</span>
          <span className="text-[8px] font-bold text-slate-300 uppercase">Life</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-8 bg-[#F9FAFB] min-h-full font-sans">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6 bg-white p-4 sm:p-8 lg:p-10 rounded-2xl sm:rounded-[3.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 sm:gap-8">
          <div className="relative shrink-0">
            <div className="bg-slate-900 p-3 sm:p-6 rounded-xl sm:rounded-[2.5rem] shadow-2xl shadow-indigo-200">
              <Settings2 className="w-6 h-6 sm:w-12 sm:h-12 text-indigo-400 animate-[spin_8s_linear_infinite]" />
            </div>
            <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 bg-emerald-500 p-1 sm:p-2 rounded-full border-2 sm:border-4 border-white">
              <ShieldCheck className="w-2.5 h-2.5 sm:w-4 sm:h-4 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-lg sm:text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2 sm:gap-4">
              Belt <span className="text-indigo-600">Commander</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1">
              <span className="bg-slate-100 text-slate-600 text-[9px] sm:text-[10px] font-black px-2.5 py-0.5 sm:px-4 sm:py-1.5 rounded-full uppercase tracking-wider border border-slate-200">Seuil: {EXPIRATION_THRESHOLD_DAYS} Jours</span>
              <div className="hidden sm:block h-1.5 w-1.5 rounded-full bg-indigo-200"></div>
              <p className="text-slate-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-tight">Analyse basée sur la dernière maintenance connue</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between sm:justify-start">
          <div className="bg-slate-50 px-4 py-2 sm:px-10 sm:py-5 rounded-xl sm:rounded-[2.5rem] border border-slate-100 flex flex-col items-center">
            <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Fleet Health</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl sm:text-5xl font-black tracking-tighter ${stats.complianceRate < 70 ? 'text-rose-600' : 'text-emerald-600'}`}>{stats.complianceRate}%</span>
            </div>
          </div>
          <button 
            onClick={exportToExcel}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 sm:gap-4 px-4 py-3 sm:px-10 sm:py-6 bg-indigo-600 hover:bg-slate-900 text-white rounded-xl sm:rounded-[2rem] font-black text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Rapport Unifié</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-8">
        {[
          { label: 'Sites Uniques Suivis', value: stats.total, icon: Cpu, color: 'text-slate-900', bg: 'bg-white' },
          { label: 'Sites Critiques', value: stats.red, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50/30', border: 'border-rose-100' },
          { label: 'Sites en Vigilance', value: stats.orange, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50/30', border: 'border-amber-100' },
          { label: 'Parc Conforme', value: stats.green, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50/30', border: 'border-emerald-100' }
        ].map((kpi, i) => (
          <div key={i} className={`${kpi.bg} p-3.5 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-sm border ${kpi.border || 'border-slate-100'} group hover:shadow-2xl transition-all duration-300`}>
            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tight sm:tracking-[0.2em] mb-1 sm:mb-3 truncate">{kpi.label}</p>
            <div className="flex justify-between items-end">
              <h4 className={`text-2xl sm:text-5xl font-black tracking-tighter ${kpi.color}`}>{kpi.value}</h4>
              <div className={`${kpi.color} opacity-20 group-hover:opacity-100 transition-all duration-300`}>
                <kpi.icon className="w-5 h-5 sm:w-12 sm:h-12" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-4 sm:p-10 rounded-2xl sm:rounded-[3.5rem] shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-10 items-stretch lg:items-end">
          <div className="flex-1 space-y-1.5 sm:space-y-3">
            <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 px-1">
              <Search className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" /> Scanner un Site Physique Unique
            </label>
            <input 
              type="text" 
              placeholder="Rechercher par Nom ou ID..." 
              className="w-full bg-slate-50 border-none rounded-xl sm:rounded-[2rem] px-4 py-2.5 sm:px-8 sm:py-5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:space-y-3 w-full lg:w-auto">
            <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 px-1">
              <Filter className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" /> Filtrage par Diagnostic
            </label>
            <div className="flex bg-slate-50 p-1 sm:p-2 rounded-xl sm:rounded-[2rem] border border-slate-100 overflow-x-auto">
              {['ALL', 'RED', 'ORANGE', 'GREEN'].map((s) => (
                <button 
                  key={s} 
                  onClick={() => setFilterStatus(s as 'ALL' | 'RED' | 'ORANGE' | 'GREEN')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 sm:px-8 sm:py-3 rounded-lg sm:rounded-[1.5rem] text-[9px] sm:text-[10px] font-black transition-all whitespace-nowrap ${filterStatus === s ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {s === 'ALL' ? 'TOUS' : s === 'RED' ? 'CRITIQUE' : s === 'ORANGE' ? 'VIGILANCE' : 'SAIN'}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={() => { setSearchTerm(''); setFilterStatus('ALL'); setDateRange({start:'', end:''}); }}
            className="p-2.5 sm:p-5 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl sm:rounded-2xl border border-slate-100 transition-all active:scale-95 self-end"
            title="Réinitialiser"
          >
            <RotateCcw className="w-4 h-4 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-md border border-slate-200 overflow-hidden mb-12 sm:mb-20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider shadow-sm">
                <th className="px-4 py-4 sm:px-8 sm:py-5">Santé Courroie (Dernière)</th>
                <th className="px-3 py-4 sm:px-6 sm:py-5">ID Site</th>
                <th className="px-3 py-4 sm:px-6 sm:py-5">Site Physique</th>
                <th className="px-3 py-4 sm:px-6 sm:py-5">Dernier Remplacement</th>
                <th className="px-3 py-4 sm:px-6 sm:py-5">Prochaine Échéance</th>
                <th className="px-3 py-4 sm:px-6 sm:py-5 text-center">Estimation Heures</th>
                <th className="px-3 py-4 sm:px-6 sm:py-5 text-center">Âge Maintenance</th>
                <th className="px-3 py-4 sm:px-6 sm:py-5">Commentaire Manuel</th>
                <th className="px-4 py-4 sm:px-8 sm:py-5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredResults.map((item, idx) => (
                <tr key={idx} className="hover:bg-indigo-50/30 transition-all group">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-8">
                      <BeltStack days={item.daysElapsed} status={item.status} />
                      <div className="flex flex-col">
                        <span className={`text-[10px] font-black uppercase tracking-tighter ${item.status === 'RED' ? 'text-rose-600' : item.status === 'ORANGE' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {item.status === 'RED' ? 'ALERTE : Remplacement Échu' : item.status === 'ORANGE' ? 'PLANIFIER MAINTENANCE' : 'OPÉRATIONNEL'}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Donnée consolidée</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-8">
                     <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm uppercase tracking-wider">
                       {item.lastID}
                     </span>
                  </td>
                  <td className="px-6 py-8">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-300" /> {item.siteName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase ml-6">{item.region}</span>
                    </div>
                  </td>
                  <td className="px-6 py-8">
                    <div className="flex flex-col">
                      <span className="text-xs font-black flex items-center gap-3 text-slate-900">
                        <Calendar className="w-4 h-4 text-indigo-400 opacity-60" />
                        {item.lastReplacementDate?.toLocaleDateString('fr-FR')}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 ml-7">SWO : {item.lastSWO}</span>
                    </div>
                  </td>
                  <td className="px-6 py-8">
                    <div className={`text-xs font-black flex items-center gap-2 ${item.status === 'RED' ? 'text-rose-600' : 'text-indigo-600'}`}>
                        <CalendarCheck className="w-4 h-4 opacity-50" />
                        {item.nextReplacementDate?.toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                  <td className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center gap-2 bg-slate-50 py-3 rounded-2xl border border-slate-100">
                       <Zap className={`w-4 h-4 ${item.status === 'RED' ? 'text-rose-500' : 'text-amber-500'}`} />
                       <span className={`text-xl font-black ${item.status === 'RED' ? 'text-rose-600' : 'text-slate-800'}`}>{item.estimatedHours}h</span>
                    </div>
                  </td>
                  <td className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center">
                       <span className={`text-xl font-black ${item.status === 'RED' ? 'text-rose-600' : 'text-slate-800'}`}>{item.daysElapsed}</span>
                       <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Jours</span>
                    </div>
                  </td>
                  <td className="px-6 py-8">
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
                  <td className="px-10 py-8 text-right">
                    <div className="bg-white p-3 rounded-2xl text-slate-300 group-hover:text-indigo-600 transition-all cursor-help border border-transparent shadow-sm">
                      <Info className="w-5 h-5" />
                    </div>
                  </td>
                </tr>
              ))}
              {filteredResults.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-32 text-center text-slate-300 italic">
                    <div className="flex flex-col items-center gap-6">
                      <Activity className="w-20 h-20 opacity-5" />
                      <p className="text-sm font-black uppercase tracking-[0.3em]">Aucune donnée unique détectée</p>
                    </div>
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
