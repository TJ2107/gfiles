import React, { useMemo, useState } from 'react';
import { GlobalFileRow } from '../types';
import { 
  Users, Briefcase, CheckCircle2, Clock, Search, 
  Download, ArrowUpRight, User, Calendar, MapPin, 
  ListFilter, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseDate } from '../utils/dateHelpers';

interface FEModuleProps {
  data: GlobalFileRow[];
  onFilterChange: (column: string, value: string) => void;
  onSwitchToData: () => void;
}

const formatDateDisplay = (val: string | number | Date | null | undefined): string => {
  const d = parseDate(val);
  if (!d) return typeof val === 'string' ? val : '-';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

export const FEModule: React.FC<FEModuleProps> = ({ data, onFilterChange, onSwitchToData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [selectedFeName, setSelectedFeName] = useState<string | null>(null);

  // Group and process FEs and their assigned SWO records
  const feData = useMemo(() => {
    const list: {
      name: string;
      rows: GlobalFileRow[];
      total: number;
      closed: number;
      open: number;
      completionRate: number;
    }[] = [];

    const feMap = new Map<string, { displayName: string; rows: GlobalFileRow[] }>();

    data.forEach(row => {
      // Technician identification based strictly on "Assigned to"
      const rawFe = row["Assigned to"] || row["assigned_to"];
      if (!rawFe) return;

      const cleanedRaw = String(rawFe).trim().replace(/\s+/g, ' ');
      if (!cleanedRaw || cleanedRaw === '-' || cleanedRaw.toLowerCase() === 'none') return;

      const normalizedKey = cleanedRaw.toLowerCase();

      // Format to clean Title Case (e.g., "Ibrahima Ndiaye")
      const displayName = cleanedRaw
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      if (!feMap.has(normalizedKey)) {
        feMap.set(normalizedKey, { displayName, rows: [] });
      }
      feMap.get(normalizedKey)!.rows.push(row);
    });

    feMap.forEach(({ displayName, rows }) => {
      let closed = 0;
      let open = 0;

      rows.forEach(row => {
        const state = String(row["State SWO"] || row["status"] || "").trim().toUpperCase();
        if (state === 'CLOSED' || state === 'CLOSE' || state === 'FERMÉ') {
          closed++;
        } else {
          open++;
        }
      });

      const total = rows.length;
      const completionRate = total > 0 ? Math.round((closed / total) * 100) : 0;

      list.push({
        name: displayName,
        rows,
        total,
        closed,
        open,
        completionRate
      });
    });

    // Sort alphabetically by FE Name
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // General FE group statistics
  const stats = useMemo(() => {
    let totalAssignedSWO = 0;
    let totalClosedSWO = 0;

    feData.forEach(fe => {
      totalAssignedSWO += fe.total;
      totalClosedSWO += fe.closed;
    });

    const totalOpenSWO = totalAssignedSWO - totalClosedSWO;
    const globalCompletionRate = totalAssignedSWO > 0 ? Math.round((totalClosedSWO / totalAssignedSWO) * 100) : 0;

    return {
      totalFEs: feData.length,
      totalAssignedSWO,
      totalClosedSWO,
      totalOpenSWO,
      globalCompletionRate
    };
  }, [feData]);

  // Automatically select first FE if none is selected
  const activeFe = useMemo(() => {
    if (feData.length === 0) return null;
    if (selectedFeName) {
      const found = feData.find(f => f.name === selectedFeName);
      if (found) return found;
    }
    return feData[0];
  }, [feData, selectedFeName]);

  // Filter SWOs of the current active FE based on search and status
  const filteredSWOs = useMemo(() => {
    if (!activeFe) return [];

    return activeFe.rows.filter(row => {
      // 1. Status Filter
      const state = String(row["State SWO"] || row["status"] || "").trim().toUpperCase();
      const isClosed = state === 'CLOSED' || state === 'CLOSE' || state === 'FERMÉ';

      if (statusFilter === 'CLOSED' && !isClosed) return false;
      if (statusFilter === 'OPEN' && isClosed) return false;

      // 2. Search Term Filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const swoNum = String(row["N° SWO"] || "").toLowerCase();
        const desc = String(row["Short description"] || row["Description"] || "").toLowerCase();
        const site = String(row["Nom du site"] || "").toLowerCase();
        const region = String(row["Region"] || "").toLowerCase();

        return swoNum.includes(term) || desc.includes(term) || site.includes(term) || region.includes(term);
      }

      return true;
    });
  }, [activeFe, statusFilter, searchTerm]);

  // Get a consistent avatar background color from engineer name
  const getAvatarColor = (name: string): string => {
    const colors = [
      'from-indigo-500 to-purple-600',
      'from-blue-500 to-indigo-600',
      'from-violet-500 to-purple-700',
      'from-cyan-500 to-blue-600',
      'from-emerald-500 to-teal-600',
      'from-amber-500 to-orange-600',
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  const getInitials = (name: string): string => {
    const parts = name.split(/[\s-]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleInspectSWO = (swoNum: string) => {
    onFilterChange("N° SWO", swoNum);
    onSwitchToData();
  };

  const exportExcel = () => {
    const exportRows: Record<string, string | number>[] = [];

    feData.forEach(fe => {
      fe.rows.forEach(row => {
        const state = String(row["State SWO"] || row["status"] || "").trim().toUpperCase();
        const stateLabel = (state === 'CLOSED' || state === 'CLOSE' || state === 'FERMÉ') ? 'Fermé' : 'Ouvert';
        const rawDate = row["Date de création du SWO"] || row["Date de planification"] || row["Date de remontée"] || "";

        exportRows.push({
          "Field Engineer": fe.name,
          "N° SWO": String(row["N° SWO"] || ""),
          "Date": rawDate ? formatDateDisplay(rawDate) : "-",
          "Nom de Site": String(row["Nom du site"] || row["Names site"] || "-"),
          "Région": String(row["Region"] || "-"),
          "Priorité": String(row["Priorité"] || "-"),
          "Description": String(row["Short description"] || row["Description"] || "-"),
          "Statut SWO": stateLabel,
          "X Status": String(row["X"] || "-")
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SWO_par_FE");
    XLSX.writeFile(workbook, `Rapport_SWO_par_Field_Engineers.xlsx`);
  };

  return (
    <div className="p-6 h-full flex flex-col gap-6" id="fe-module-root">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Module Field Engineers (FE)</h2>
            <p className="text-xs text-slate-500 font-bold mt-0.5">Suivi et répartition des SWO assignés par technicien de terrain</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={exportExcel}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl text-xs font-bold transition-all duration-300 shadow-md active:scale-95 border border-slate-850"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Exporter Rapport FE</span>
          </button>
        </div>
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Techniciens Actifs</p>
          <h4 className="text-3xl font-black text-slate-800 tracking-tight mt-1">{stats.totalFEs}</h4>
          <p className="text-[10px] text-slate-500 font-bold mt-2">Personnel terrain répertorié</p>
          <div className="absolute -right-2 -bottom-2 text-indigo-50 opacity-40 group-hover:scale-110 transition-transform duration-300">
            <Users className="w-16 h-16" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total SWO Assignés</p>
          <h4 className="text-3xl font-black text-indigo-600 tracking-tight mt-1">{stats.totalAssignedSWO}</h4>
          <p className="text-[10px] text-slate-500 font-bold mt-2">Volume combiné des FE</p>
          <div className="absolute -right-2 -bottom-2 text-indigo-50 opacity-40 group-hover:scale-110 transition-transform duration-300">
            <Briefcase className="w-16 h-16" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">SWO Clos / Résolus</p>
          <h4 className="text-3xl font-black text-emerald-600 tracking-tight mt-1">{stats.totalClosedSWO}</h4>
          <p className="text-[10px] text-slate-500 font-bold mt-2">{stats.globalCompletionRate}% de taux d'exécution global</p>
          <div className="absolute -right-2 -bottom-2 text-emerald-50 opacity-40 group-hover:scale-110 transition-transform duration-300">
            <CheckCircle2 className="w-16 h-16" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">SWO Liés / En cours</p>
          <h4 className="text-3xl font-black text-amber-600 tracking-tight mt-1">{stats.totalOpenSWO}</h4>
          <p className="text-[10px] text-slate-500 font-bold mt-2">Nécessitant une intervention terrain</p>
          <div className="absolute -right-2 -bottom-2 text-amber-50 opacity-40 group-hover:scale-110 transition-transform duration-300">
            <Clock className="w-16 h-16" />
          </div>
        </div>
      </div>

      {/* Main split interactive section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[450px] overflow-hidden">
        {/* Left Column: FEs Master List (4 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden max-h-[600px] lg:max-h-none">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-black text-slate-700 uppercase text-xs tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              <span>Liste des Field Engineers ({feData.length})</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Sélectionner un technicien pour filtrer sa fiche</p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 custom-scrollbar p-2">
            {feData.length > 0 ? (
              feData.map((fe) => {
                const isSelected = activeFe?.name === fe.name;
                const avatarBg = getAvatarColor(fe.name);

                return (
                  <button
                    key={fe.name}
                    onClick={() => {
                      setSelectedFeName(fe.name);
                      setStatusFilter('ALL');
                    }}
                    className={`w-full p-3.5 my-1 rounded-2xl text-left flex items-center justify-between transition-all duration-300 gap-3 group ${
                      isSelected 
                        ? 'bg-indigo-50/70 border border-indigo-200/40 shadow-[0_4px_16px_rgba(79,70,229,0.06)]' 
                        : 'hover:bg-slate-50/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarBg} text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm`}>
                        {getInitials(fe.name)}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className={`text-xs font-black truncate max-w-[170px] uppercase tracking-wide group-hover:text-indigo-600 transition-colors ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                          {fe.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-slate-400">{fe.total} SWO</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className={`text-[10px] font-bold ${fe.open > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {fe.open} en cours
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end shrink-0">
                      <div className="text-xs font-black text-slate-800">{fe.completionRate}%</div>
                      {/* Custom compact progress bar */}
                      <div className="w-14 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${fe.completionRate > 80 ? 'bg-emerald-500' : fe.completionRate > 50 ? 'bg-indigo-500' : 'bg-amber-500'}`} 
                          style={{ width: `${fe.completionRate}%` }}
                        ></div>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                <AlertCircle className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs font-bold font-mono">Aucun technicien assigné aux SWO dans ce fichier</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: SWO Assigned Rows details grid (8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          {activeFe ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Technician Header Banner */}
              <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getAvatarColor(activeFe.name)} text-white flex items-center justify-center font-black text-md shadow-md`}>
                    {getInitials(activeFe.name)}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{activeFe.name}</h3>
                    <p className="text-[11px] text-slate-400 font-bold mt-1 flex items-center gap-2">
                      <span>{activeFe.closed} SWO fermés</span>
                      <span>•</span>
                      <span>{activeFe.open} SWO ouverts</span>
                      <span>•</span>
                      <span className="text-indigo-600 font-extrabold">{activeFe.completionRate}% Taux d'achèvement</span>
                    </p>
                  </div>
                </div>

                {/* Micro Status Badges or filters */}
                <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
                  <button
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-250 ${
                      statusFilter === 'ALL' 
                        ? 'bg-white text-slate-800 shadow-sm font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tous ({activeFe.total})
                  </button>
                  <button
                    onClick={() => setStatusFilter('OPEN')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-250 ${
                      statusFilter === 'OPEN' 
                        ? 'bg-amber-500 text-white shadow-sm font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Ouverts ({activeFe.open})
                  </button>
                  <button
                    onClick={() => setStatusFilter('CLOSED')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-250 ${
                      statusFilter === 'CLOSED' 
                        ? 'bg-emerald-500 text-white shadow-sm font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Fermés ({activeFe.closed})
                  </button>
                </div>
              </div>

              {/* Filtering & Search utilities bar */}
              <div className="px-6 py-4 border-b border-slate-50 bg-white flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Chercher N° SWO, description, site..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400 font-bold transition-all"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                    >
                      Effacer
                    </button>
                  )}
                </div>

                <div className="text-[10px] font-bold text-slate-400 font-mono">
                  {filteredSWOs.length} résultat{filteredSWOs.length > 1 ? 's' : ''} trouvé{filteredSWOs.length > 1 ? 's' : ''}
                </div>
              </div>

              {/* Dynamic scrollable SWO items list */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
                {filteredSWOs.length > 0 ? (
                  <div className="space-y-3.5">
                    {filteredSWOs.map((row) => {
                      const state = String(row["State SWO"] || row["status"] || "").trim().toUpperCase();
                      const isClosed = state === 'CLOSED' || state === 'CLOSE' || state === 'FERMÉ';
                      
                      // Identify date field to display
                      const rawDate = row["Date de création du SWO"] || row["Date de planification"] || row["Date de remontée"] || row["Closing date"] || row["Date de Clôture"];

                      return (
                        <div 
                          key={String(row["N° SWO"] || row["ID"] || Math.random())}
                          className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
                        >
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* SWO badge */}
                              <span className="text-[10px] font-black font-mono text-indigo-600 px-2.5 py-1 bg-indigo-50 rounded-lg">
                                SWO #{row["N° SWO"] || "N/A"}
                              </span>

                              {/* Site name & region badge */}
                              <span className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {row["Nom du site"] || row["Names site"] || "-"}
                                {row["Region"] && <span className="text-[10px] text-slate-400 font-black">({row["Region"]})</span>}
                              </span>

                              {/* Status Badge */}
                              <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg tracking-wider ${
                                isClosed 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                  : 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse'
                              }`}>
                                {isClosed ? 'Fermé' : 'En cours'}
                              </span>

                              {row["Priorité"] && (
                                <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                  Prio {row["Priorité"]}
                                </span>
                              )}
                            </div>

                            {/* Description text */}
                            <h4 className="text-[12px] font-extrabold text-slate-800 leading-snug uppercase max-w-3xl">
                              {row["Short description"] || row["Description"] || "(Sans description)"}
                            </h4>

                            {/* Info footer */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1.5 text-[10px] text-slate-400 font-bold">
                              {rawDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>Date: {formatDateDisplay(rawDate)}</span>
                                </span>
                              )}
                              {row["X"] && (
                                <span className="flex items-center gap-1 text-slate-500 font-extrabold bg-slate-50 px-1.5 py-0.5 rounded">
                                  X: {row["X"]}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick Inspect call-to-action */}
                          <button
                            onClick={() => handleInspectSWO(String(row["N° SWO"]))}
                            className="flex items-center gap-1 px-3.5 py-2.5 bg-slate-50 text-slate-600 hover:text-indigo-600 group-hover:bg-indigo-50 border border-slate-100 group-hover:border-indigo-100 rounded-xl text-[10px] font-black transition-all shrink-0 active:scale-95"
                          >
                            <span>Détails</span>
                            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-100">
                    <ListFilter className="w-12 h-12 text-slate-300 mb-3 animate-bounce" />
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">Aucun SWO correspondant aux critères</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">Essayez de retirer vos filtres de statut ou de modifier votre terme de recherche.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-slate-400 h-full text-center">
              <User className="w-16 h-16 opacity-35 text-slate-300 mb-3" />
              <h4 className="text-sm font-black text-slate-600 uppercase">Aucun Field Engineer disponible</h4>
              <p className="text-[11px] text-slate-500 max-w-xs mt-1 font-bold">Veuillez d'abord importer des données valides de SWO dans l'application.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
