
import React, { useMemo, useState, useEffect } from 'react';
import { GlobalFileRow } from '../types';
import { 
  Settings2, Search, Calendar, MapPin, 
  Download, CalendarCheck, RotateCcw, Clock, Activity, 
  ShieldCheck, Info, AlertTriangle, Cpu, Save, Loader2
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
    
    let colorClass = "bg-emerald-500 shadow-xs";
    if (status === 'ORANGE') colorClass = "bg-amber-500 shadow-xs";
    if (status === 'RED') colorClass = "bg-rose-500 shadow-xs animate-pulse";

    return (
      <div className="flex items-center gap-2">
        <div className="w-10 h-4 border border-slate-300 rounded p-0.5 relative flex items-center bg-slate-50 overflow-hidden shadow-inner">
          <div 
            className={`h-full rounded-xs transition-all duration-700 ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-[10px] font-black text-slate-600 font-mono w-7 text-right">{percentage}%</span>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-[1600px] mx-auto bg-[#F9FAFB] min-h-full font-sans">
      {/* HEADER COMPACT ET ÉLÉGANT */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-2.5 sm:p-3 rounded-xl shadow-md shadow-slate-200 shrink-0 text-indigo-400">
            <Settings2 className="w-5 h-5 sm:w-6 sm:h-6 animate-[spin_10s_linear_infinite]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                Belt <span className="text-indigo-600">Commander</span>
              </h2>
              <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase">
                Seuil: {EXPIRATION_THRESHOLD_DAYS} Jours
              </span>
            </div>
            <p className="text-slate-400 text-[11px] font-medium mt-0.5">Audit et suivi de cycle d'usure des courroies</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Santé Courroies:</span>
            <span className={`text-base font-black ${stats.complianceRate < 70 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {stats.complianceRate}%
            </span>
          </div>
          <button 
            onClick={exportToExcel}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* KPI DASHBOARD OPTIMISÉ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {[
          { label: 'Sites Suivis', value: stats.total, icon: Cpu, color: 'text-slate-900', bg: 'bg-white', border: 'border-slate-200/80' },
          { label: 'Critiques (Échu)', value: stats.red, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50/40', border: 'border-rose-200/80' },
          { label: 'Vigilance (Alerte)', value: stats.orange, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50/40', border: 'border-amber-200/80' },
          { label: 'Conformes (Sain)', value: stats.green, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50/40', border: 'border-emerald-200/80' }
        ].map((kpi, i) => (
          <div key={i} className={`${kpi.bg} p-3.5 sm:p-4 rounded-xl shadow-xs border ${kpi.border} flex items-center justify-between`}>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{kpi.label}</p>
              <h4 className={`text-xl sm:text-2xl font-black tracking-tight ${kpi.color}`}>{kpi.value}</h4>
            </div>
            <div className={`p-2 rounded-lg ${kpi.bg} ${kpi.color} opacity-80`}>
              <kpi.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* FILTRES COMPACTS */}
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-xs border border-slate-200/80 flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Rechercher par Nom ou ID..." 
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {['ALL', 'RED', 'ORANGE', 'GREEN'].map((s) => (
              <button 
                key={s} 
                onClick={() => setFilterStatus(s as 'ALL' | 'RED' | 'ORANGE' | 'GREEN')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all whitespace-nowrap ${
                  filterStatus === s ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {s === 'ALL' ? 'TOUT' : s === 'RED' ? 'CRITIQUE' : s === 'ORANGE' ? 'VIGILANCE' : 'SAIN'}
              </button>
            ))}
          </div>

          <button 
            onClick={() => { setSearchTerm(''); setFilterStatus('ALL'); setDateRange({start:'', end:''}); }}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-indigo-600 rounded-lg border border-slate-200 transition-colors shrink-0"
            title="Réinitialiser les filtres"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* TABLEAU DE SANTÉ OPTIMISÉ */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                <th className="px-3.5 py-2.5">Santé Courroie</th>
                <th className="px-3 py-2.5">ID Site</th>
                <th className="px-3 py-2.5">Site Physique</th>
                <th className="px-3 py-2.5">Dernier Swap</th>
                <th className="px-3 py-2.5">Prochaine Échéance</th>
                <th className="px-3 py-2.5 text-center">Heures Est.</th>
                <th className="px-3 py-2.5 text-center">Âge</th>
                <th className="px-3 py-2.5">Commentaire</th>
                <th className="px-3 py-2.5 text-right w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredResults.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <BeltStack days={item.daysElapsed} status={item.status} />
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        item.status === 'RED' ? 'bg-rose-100 text-rose-700' : item.status === 'ORANGE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.status === 'RED' ? 'Critique' : item.status === 'ORANGE' ? 'Vigilance' : 'Sain'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                     <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-200/60 font-mono">
                       {item.lastID}
                     </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {item.siteName}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">{item.region}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        {item.lastReplacementDate?.toLocaleDateString('fr-FR')}
                      </span>
                      <span className="text-[9px] text-slate-400">SWO: {item.lastSWO}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className={`font-semibold flex items-center gap-1.5 ${item.status === 'RED' ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                        <CalendarCheck className="w-3 h-3 opacity-60 shrink-0" />
                        {item.nextReplacementDate?.toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold text-xs">
                      {item.estimatedHours}h
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block font-black text-sm ${item.status === 'RED' ? 'text-rose-600' : 'text-slate-800'}`}>
                      {item.daysElapsed} <span className="text-[9px] font-normal text-slate-400">j</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="relative min-w-[140px]">
                      <input 
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                        placeholder="Ajouter une note..."
                        value={editingComment?.id === item.lastID ? editingComment.value : (manualComments[item.lastID] || "")}
                        onChange={(e) => setEditingComment({ id: item.lastID, value: e.target.value })}
                        onBlur={() => {
                          if (editingComment?.id === item.lastID) {
                            handleSaveComment(item.lastID);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editingComment?.id === item.lastID) {
                            handleSaveComment(item.lastID);
                          }
                        }}
                      />
                      {editingComment?.id === item.lastID && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                          <button 
                            onClick={() => handleSaveComment(item.lastID)}
                            disabled={isSaving === item.lastID}
                            className="p-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                            title="Enregistrer"
                          >
                            {isSaving === item.lastID ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Save className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Info className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors inline-block" title={`Dernière intervention : ${item.lastSWO}`} />
                  </td>
                </tr>
              ))}
              {filteredResults.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <Activity className="w-8 h-8 opacity-30 mx-auto mb-2" />
                    <p className="text-xs font-bold uppercase tracking-wider">Aucune donnée courroie trouvée</p>
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
