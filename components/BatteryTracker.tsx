
import React, { useMemo, useState, useEffect } from 'react';
import { GlobalFileRow } from '../types';
import { 
  Battery as BatteryIcon, Search, Calendar, MapPin, 
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
   * Composant de Pile Dynamique
   */
  const BatteryStack = ({ months, status }: { months: number, status: string }) => {
    const remainingRatio = Math.max(0, (EXPIRATION_THRESHOLD_MONTHS - months) / EXPIRATION_THRESHOLD_MONTHS);
    const percentage = remainingRatio * 100;
    
    let colorClass = "bg-emerald-500 shadow-xs";
    if (status === 'ORANGE') colorClass = "bg-amber-500 shadow-xs";
    if (status === 'RED') colorClass = "bg-rose-500 shadow-xs animate-pulse";

    return (
      <div className="flex items-center gap-2">
        <div className="relative flex items-center">
          <div className="w-10 h-5 border border-slate-300 rounded p-0.5 relative flex items-center bg-slate-50 overflow-hidden shadow-inner">
            <div 
              className={`h-full rounded-xs transition-all duration-700 ${colorClass}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="w-1 h-2 bg-slate-300 rounded-r-xs -ml-px"></div>
        </div>
        <span className="text-[10px] font-black text-slate-600 font-mono w-7 text-right">{Math.round(percentage)}%</span>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-[1600px] mx-auto bg-[#F8FAFC] min-h-full font-sans">
      {/* HEADER COMPACT ET ÉLÉGANT */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 sm:p-3 rounded-xl shadow-md shadow-indigo-100 shrink-0 text-white">
            <BatteryIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                DG Battery <span className="text-indigo-600">Life-Cycle</span>
              </h2>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase">
                Seuil: {EXPIRATION_THRESHOLD_MONTHS} Mois
              </span>
            </div>
            <p className="text-slate-400 text-[11px] font-medium mt-0.5">Monitoring d'intégrité et de cycle de vie énergétique</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Santé Parc:</span>
            <span className={`text-base font-black ${stats.complianceRate < 70 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {stats.complianceRate}%
            </span>
          </div>
          <button 
            onClick={exportToExcel}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* KPI DASHBOARD OPTIMISÉ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {[
          { label: 'Parc Total', value: stats.total, icon: Zap, color: 'text-slate-900', bg: 'bg-white', border: 'border-slate-200/80' },
          { label: 'Expirées (Critique)', value: stats.red, icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-50/40', border: 'border-rose-200/80' },
          { label: 'À Prévoir (Alerte)', value: stats.orange, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50/40', border: 'border-amber-200/80' },
          { label: 'Conformes (Actif)', value: stats.green, icon: ShieldAlert, color: 'text-emerald-600', bg: 'bg-emerald-50/40', border: 'border-emerald-200/80' }
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
            placeholder="Rechercher par Site ou ID..." 
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
                  filterStatus === s ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {s === 'ALL' ? 'TOUT' : s === 'RED' ? 'EXPIRÉ' : s === 'ORANGE' ? 'ALERTE' : 'OK'}
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
                <th className="px-3.5 py-2.5">Santé Batterie</th>
                <th className="px-3 py-2.5">ID Site</th>
                <th className="px-3 py-2.5">Localisation</th>
                <th className="px-3 py-2.5">Dernier Remplacement</th>
                <th className="px-3 py-2.5">Prochaine Échéance</th>
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
                      <BatteryStack months={item.monthsElapsed} status={item.status} />
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        item.status === 'RED' ? 'bg-rose-100 text-rose-700' : item.status === 'ORANGE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.status === 'RED' ? 'Expiré' : item.status === 'ORANGE' ? 'Alerte' : 'Conforme'}
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
                    <span className={`inline-block font-black text-sm ${item.status === 'RED' ? 'text-rose-600' : 'text-slate-800'}`}>
                      {item.monthsElapsed} <span className="text-[9px] font-normal text-slate-400">mois</span>
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
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <Activity className="w-8 h-8 opacity-30 mx-auto mb-2" />
                    <p className="text-xs font-bold uppercase tracking-wider">Aucune donnée batterie trouvée</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER INFORMATIONS */}
      <div className="bg-slate-900 rounded-xl p-4 text-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5 text-center sm:text-left">
          <h4 className="font-bold uppercase tracking-wide text-slate-200">Protocole Préventif Batteries GE</h4>
          <p className="text-slate-400 text-[11px]">
            Remplacement systématique conseillé tous les {EXPIRATION_THRESHOLD_MONTHS} mois pour assurer l'autonomie critique lors des coupures secteur.
          </p>
        </div>
        <div className="flex gap-4 shrink-0">
          <div className="text-center bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/80">
            <span className="text-sm font-black text-rose-400">{stats.red}</span>
            <span className="block text-[8px] font-bold uppercase text-slate-400">À Remplacer</span>
          </div>
          <div className="text-center bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/80">
            <span className="text-sm font-black text-emerald-400">{stats.green}</span>
            <span className="block text-[8px] font-bold uppercase text-slate-400">Conformes</span>
          </div>
        </div>
      </div>
    </div>
  );
};
