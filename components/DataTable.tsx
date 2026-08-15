
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { parseDate } from '../utils/dateHelpers';
import { GlobalFileRow, XStatus } from '../types';
import { COLUMNS, getRowColorClass, SWO_OPTIONS, X_OPTIONS, getXPriorityLevel } from '../constants';
import { Search, Columns, CalendarRange, XCircle, MoreVertical, Trash2, Copy, ClipboardPaste, Palette, ArrowUpDown, Table, Bookmark, Save, Trash, FilterX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp } from 'lucide-react';

interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string>;
  isColorSorted: boolean;
  colorFilter: string | null;
}

interface DataTableProps {
  data: GlobalFileRow[];
  setData: React.Dispatch<React.SetStateAction<GlobalFileRow[]>>;
  onUpdateRow: (index: number, field: string, value: string) => void;
  filters: Record<string, string>;
  onFilterChange: (column: string, value: string) => void;
  onApplyFilters: (filters: Record<string, string>) => void;
  onSaveDatabase?: () => void;
  canEdit?: boolean;
}

const DATE_COLUMNS = [
  "Date de création du SWO",
  "Date de remontée",
  "Date de Clôture",
  "Date de fermeture des actions",
  "Date de planification",
  "Date de transmission au client",
  "Date de validation Client",
  "Closing date",
  "PM Date",
  "Date executee",
  "PM Planned",
  "PM date execute",
  "PM date replanifiée",
  "DG Service 01 Executée",
  "DG Service 03 Executée",
  "PM aircon Executée",
  "PM AIRCON Executée"
];

const COLOR_OPTIONS = [
  { label: 'Orange (5- HTC)', value: XStatus.HTC, color: 'bg-orange-100' },
  { label: 'Jaune (4- STHIC ATV HTC)', value: XStatus.STHIC_ATV_HTC, color: 'bg-yellow-100' },
  { label: 'Bleu (3- STHIC SPA)', value: XStatus.STHIC_SPA, color: 'bg-blue-100' },
  { label: 'Indigo (2- TVX STHIC)', value: XStatus.TVX_STHIC, color: 'bg-indigo-100' },
  { label: 'Vert (1- CLOSED)', value: XStatus.CLOSED, color: 'bg-green-100' },
  { label: 'Blanc (Autres)', value: 'WHITE', color: 'bg-white border' },
];

const formatDateTime = (val: string | number | Date | null | undefined): string => {
  const d = parseDate(val);
  if (!d) return typeof val === 'string' ? val : '';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const getColumnBgClass = (colName: string) => {
  const lower = colName.toLowerCase();
  if (lower.includes("site") || lower.includes("region") || lower.includes("zone")) {
    return "bg-blue-50/70 dark:bg-blue-950/40 border-r border-slate-200/60 dark:border-slate-800 text-black";
  }
  if (lower.includes("date") || lower.includes("closing") || lower.includes("planned")) {
    return "bg-amber-50/60 dark:bg-amber-950/40 border-r border-slate-200/60 dark:border-slate-800 text-black";
  }
  if (lower.includes("pm") || lower.includes("type") || lower.includes("category")) {
    return "bg-purple-50/60 dark:bg-purple-950/40 border-r border-slate-200/60 dark:border-slate-800 text-black";
  }
  if (lower.includes("status") || lower.includes("statut") || lower.includes("state") || lower === "x") {
    return "bg-emerald-50/60 dark:bg-emerald-950/40 border-r border-slate-200/60 dark:border-slate-800 text-black";
  }
  if (lower.includes("tech") || lower.includes("name") || lower.includes("agent")) {
    return "bg-indigo-50/60 dark:bg-indigo-950/40 border-r border-slate-200/60 dark:border-slate-800 text-black";
  }
  return "bg-slate-50/70 dark:bg-slate-900/50 border-r border-slate-200/60 dark:border-slate-800 text-black";
};

export const DataTable: React.FC<DataTableProps> = ({ data, setData, onUpdateRow, filters, onFilterChange, onApplyFilters, onSaveDatabase, canEdit = false }) => {
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('globalFiles_visibleColumns');
      if (saved) return JSON.parse(saved);
    } catch {
      // Gérer l'erreur si nécessaire, par exemple en loggant
    }
    return {};
  });

  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const [activeDateFilterCol, setActiveDateFilterCol] = useState<string | null>(null);
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const [activeColAction, setActiveColAction] = useState<string | null>(null);
  const colActionRef = useRef<HTMLDivElement>(null);
  const [activeRowActionIndex, setActiveRowActionIndex] = useState<number | null>(null);
  const rowActionRef = useRef<HTMLDivElement>(null);
  const [copiedRow, setCopiedRow] = useState<GlobalFileRow | null>(null);
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const [isColorSorted, setIsColorSorted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      // Auto-collapse header/controls on mobile and tablet (screen width under 1024px)
      setIsHeaderCollapsed(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // FAVORITE VIEWS LOGIC
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      const saved = localStorage.getItem('globalFiles_savedViews');
      return saved ? JSON.parse(saved) : [];
    } catch {
      // Gérer l'erreur si nécessaire, par exemple en loggant
      return [];
    }
  });
  const [isViewsMenuOpen, setIsViewsMenuOpen] = useState(false);
  const viewsMenuRef = useRef<HTMLDivElement>(null);
  const [newViewName, setNewViewName] = useState("");

  useEffect(() => {
    localStorage.setItem('globalFiles_savedViews', JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) setIsColumnMenuOpen(false);
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) setActiveDateFilterCol(null);
      if (colActionRef.current && !colActionRef.current.contains(event.target as Node)) setActiveColAction(null);
      if (rowActionRef.current && !rowActionRef.current.contains(event.target as Node)) setActiveRowActionIndex(null);
      if (colorMenuRef.current && !colorMenuRef.current.contains(event.target as Node)) setIsColorMenuOpen(false);
      if (viewsMenuRef.current && !viewsMenuRef.current.contains(event.target as Node)) setIsViewsMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [columnMenuRef, dateFilterRef, colActionRef, rowActionRef, colorMenuRef, viewsMenuRef]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const toggleColumn = (column: string) => {
    setVisibleColumns(prev => {
      const currentVal = prev[column] !== false; 
      const newState = { ...prev, [column]: !currentVal };
      localStorage.setItem('globalFiles_visibleColumns', JSON.stringify(newState));
      return newState;
    });
  };

  const setAllColumns = (visible: boolean) => {
    const newState: Record<string, boolean> = {};
    COLUMNS.forEach(col => { newState[col] = visible; });
    setVisibleColumns(newState);
    localStorage.setItem('globalFiles_visibleColumns', JSON.stringify(newState));
  };

  const activeColumns = useMemo(() => COLUMNS.filter(col => visibleColumns[col] !== false), [visibleColumns]);

  const handleDateFilterApply = (column: string, start: string, end: string) => {
    if (!start && !end) onFilterChange(column, '');
    else onFilterChange(column, `DATE_RANGE|${start}|${end}`);
    setActiveDateFilterCol(null);
  };

  const copyRow = (row: GlobalFileRow) => {
    setCopiedRow({...row});
    setActiveRowActionIndex(null);
  };

  const deleteRow = (rowToDelete: GlobalFileRow) => {
    if (window.confirm("Voulez-vous vraiment supprimer cette ligne ?")) {
      setData(prev => prev.filter(r => r !== rowToDelete));
      setHasUnsavedChanges(true);
    }
    setActiveRowActionIndex(null);
  };

  const pasteRow = () => {
    if (copiedRow) {
      setData(prev => [...prev, {...copiedRow}]);
    }
  };

  const copyColumn = (col: string) => {
    const values = data.map(row => row[col]).join('\n');
    navigator.clipboard.writeText(values).then(() => {
      alert(`Contenu de la colonne "${col}" copié !`);
    }).catch(err => console.error(err));
    setActiveColAction(null);
  };

  const deleteColumn = (col: string) => {
    if (window.confirm(`Voulez-vous supprimer DÉFINITIVEMENT les données de la colonne "${col}" dans toute la base ? (Les données seront effacées)`)) {
      setData(prev => prev.map(row => {
        const newRow = { ...row };
        delete newRow[col];
        return newRow;
      }));
      setHasUnsavedChanges(true);
      // Explicitly hide it from view
      setVisibleColumns(prev => {
        const newState = { ...prev, [col]: false };
        localStorage.setItem('globalFiles_visibleColumns', JSON.stringify(newState));
        return newState;
      });
    }
    setActiveColAction(null);
  };

  const pasteColumn = async (col: string) => {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split(/\r?\n/);
      if (lines.length > 0) {
        if (window.confirm(`Coller ${lines.length} valeurs dans la colonne "${col}" ? Cela écrasera les données existantes.`)) {
           setData(prev => {
             const newData = [...prev];
             lines.forEach((val, i) => {
               if (i < newData.length) {
                 newData[i] = { ...newData[i], [col]: val.trim() };
               }
             });
             return newData;
           });
           setHasUnsavedChanges(true);
        }
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
      alert("Impossible de lire le presse-papier. Vérifiez les permissions.");
    }
    setActiveColAction(null);
  };

  const handleSave = () => {
    if (onSaveDatabase) {
      onSaveDatabase();
      setHasUnsavedChanges(false);
    }
  };

  const saveCurrentView = () => {
    if (!newViewName.trim()) return;
    const newView: SavedView = {
      id: Date.now().toString(),
      name: newViewName.trim(),
      filters: { ...filters },
      isColorSorted,
      colorFilter
    };
    setSavedViews(prev => [...prev, newView]);
    setNewViewName("");
  };

  const loadView = (view: SavedView) => {
    onApplyFilters(view.filters);
    setIsColorSorted(view.isColorSorted);
    setColorFilter(view.colorFilter);
    setIsViewsMenuOpen(false);
  };

  const deleteView = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSavedViews(prev => prev.filter(v => v.id !== id));
  };

  const clearAllFilters = () => {
    onApplyFilters({});
    setColorFilter([]);
    setIsColorSorted(false);
  };

  const filteredData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    let res = data.filter(row => {
      if (!row) return false;
      
      const matchesStandardFilters = Object.entries(filters).every(([key, filterValue]) => {
        const val = filterValue as string;
        if (!val) return true;
        
        if (val.startsWith('DATE_RANGE|')) {
          const [, startStr, endStr] = val.split('|');
          const rowDate = parseDate(row[key]);
          if (!rowDate) return false;
          rowDate.setHours(0, 0, 0, 0);
          if (startStr) {
            const startDate = new Date(startStr);
            startDate.setHours(0, 0, 0, 0);
            if (rowDate < startDate) return false;
          }
          if (endStr) {
            const endDate = new Date(endStr);
            endDate.setHours(0, 0, 0, 0);
            if (rowDate > endDate) return false;
          }
          return true;
        }

        const cellValue = row[key];
        const cellString = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';
        return cellString.toLowerCase().includes(val.toLowerCase());
      });

      if (!matchesStandardFilters) return false;

      if (colorFilter) {
        const rowLevel = getXPriorityLevel(row["X"]);
        if (colorFilter === 'WHITE') {
          if (rowLevel !== 0) return false;
        } else {
          const targetLevel = getXPriorityLevel(colorFilter);
          if (rowLevel !== targetLevel) return false;
        }
      }

      return true;
    });

    if (isColorSorted) {
      res = [...res].sort((a, b) => {
        const pA = getXPriorityLevel(a["X"]);
        const pB = getXPriorityLevel(b["X"]);
        if (pA !== pB) return pB - pA;
        const nameA = String(a["Nom du site"] || "");
        const nameB = String(b["Nom du site"] || "");
        return nameA.localeCompare(nameB);
      });
    }

    return res;
  }, [data, filters, colorFilter, isColorSorted]);

  const hasAnyActiveFilter = Object.keys(filters).length > 0 || !!colorFilter || isColorSorted;

  // Reset to first page when filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, colorFilter]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, currentPage, rowsPerPage]);

  return (
    <div className="flex flex-col h-full bg-white shadow-[0_20px_50px_rgba(0,0,0,0.04),_0_1px_2px_rgba(0,0,0,0.02),_inset_0_1px_2px_rgba(255,255,255,0.8)] border border-slate-100 rounded-[2.5rem] overflow-hidden animate-in fade-in duration-500">
      <div className={`border-b bg-gray-50/80 backdrop-blur-sm flex flex-col gap-3 relative z-30 transition-all duration-300 ${isHeaderCollapsed ? 'p-3' : 'p-5'}`}>
        <div className="flex flex-row justify-between items-center gap-4 w-full">
             <div className="flex items-center gap-3">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
                  <Table className="w-5 h-5 text-indigo-600" />
                  <span className="hidden xs:inline">Données</span> 
                  <span className="text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full text-xs sm:text-sm ml-1">{filteredData.length}</span>
                </h2>
             </div>
             <div className="flex items-center gap-2">
               {copiedRow && (
                   <button 
                    onClick={pasteRow}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 duration-200"
                   >
                     <ClipboardPaste className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Coller Ligne</span>
                   </button>
               )}
               {hasAnyActiveFilter && (
                 <button 
                   onClick={clearAllFilters}
                   className="flex items-center gap-2 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 duration-200 animate-in zoom-in"
                   title="Réinitialiser tous les filtres"
                 >
                   <FilterX className="w-3.5 h-3.5" />
                   <span className="hidden sm:inline">Effacer Filtres</span>
                 </button>
               )}
               {canEdit && onSaveDatabase && (
                 <button 
                   onClick={handleSave}
                   className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 relative ${hasUnsavedChanges ? 'bg-orange-500 hover:bg-orange-600 animate-pulse ring-2 ring-orange-300 ring-offset-2 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                   title={hasUnsavedChanges ? "Vous avez des modifications non enregistrées !" : "Enregistrer les modifications dans Row Data"}
                 >
                   <Save className="w-3.5 h-3.5 text-white" />
                   <span className="hidden sm:inline text-white">{hasUnsavedChanges ? "Enregistrer" : "Sauvegarder"}</span>
                   {hasUnsavedChanges && (
                     <span className="absolute -top-1 -right-1 flex h-3 w-3">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                     </span>
                   )}
                 </button>
               )}

               <button
                 onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                 className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-extrabold shadow-sm transition-all duration-200 active:scale-95"
                 title={isHeaderCollapsed ? "Afficher les filtres & contrôles" : "Réduire / Voir plus de lignes"}
               >
                 {isHeaderCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                 <span>{isHeaderCollapsed ? "Options" : "Masquer"}</span>
               </button>
             </div>
        </div>
        
        {!isHeaderCollapsed && (

        
          <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto animate-in slide-in-from-top-2 duration-300">
          {/* VUES FAVORITES DROPDOWN */}
          <div className="relative flex-grow sm:flex-grow-0" ref={viewsMenuRef}>
            <button 
              onClick={() => setIsViewsMenuOpen(!isViewsMenuOpen)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 border rounded-xl shadow-sm text-xs font-bold transition-all duration-200 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95"
            >
              <Bookmark className={`w-4 h-4 ${savedViews.length > 0 ? 'text-indigo-600 fill-indigo-600' : 'text-gray-400'}`} />
              <span>Vues Favorites</span>
            </button>

            {isViewsMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-[280px] sm:w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] z-50 p-4 animate-in zoom-in-95 origin-top-right">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-50 pb-2">Gérer vos vues personnalisées</div>
                
                <div className="mb-4 space-y-2">
                  <div className="flex items-center gap-1">
                    <input 
                      type="text" 
                      placeholder="Nom de la vue..." 
                      className="flex-1 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                    />
                    <button 
                      onClick={saveCurrentView}
                      disabled={!newViewName.trim()}
                      className="p-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 disabled:bg-gray-300 transition-all hover:bg-indigo-700 shadow-md active:scale-95"
                      title="Sauvegarder les filtres actuels"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {savedViews.length > 0 ? (
                    savedViews.map(view => (
                      <div 
                        key={view.id}
                        onClick={() => loadView(view)}
                        className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-indigo-50 cursor-pointer transition-all border border-transparent hover:border-indigo-100"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{view.name}</span>
                          <span className="text-[9px] text-slate-400 font-bold">{Object.keys(view.filters).length} filtres actifs</span>
                        </div>
                        <button 
                          onClick={(e) => deleteView(e, view.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 text-red-400 hover:text-red-600 rounded-lg transition-all"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-slate-300 italic text-[10px] font-bold uppercase tracking-widest">Aucune vue enregistrée</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex-grow sm:flex-grow-0" ref={colorMenuRef}>
             <button 
               onClick={() => setIsColorMenuOpen(!isColorMenuOpen)}
               className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 border rounded-xl shadow-sm text-xs font-bold transition-all duration-200 active:scale-95 ${colorFilter ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
             >
               <Palette className="w-4 h-4" />
               <span>{colorFilter ? 'Couleur Actif' : 'Couleur'}</span>
             </button>

             {isColorMenuOpen && (
               <div className="absolute top-full right-0 mt-2 w-[240px] sm:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] z-50 p-2 animate-in zoom-in-95 origin-top-right">
                 <div className="text-[10px] font-black text-gray-400 dark:text-slate-400 px-3 py-2 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 mb-1">Filtrer par statut technique (X)</div>
                 <div className="space-y-1">
                   {COLOR_OPTIONS.map(opt => (
                     <button
                       key={opt.value}
                       onClick={() => { setColorFilter(colorFilter === opt.value ? null : opt.value); setIsColorMenuOpen(false); }}
                       className={`w-full text-left px-3 py-2.5 text-xs rounded-xl flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${colorFilter === opt.value ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-gray-600 dark:text-slate-300'}`}
                     >
                       <span className={`w-3.5 h-3.5 rounded-full border shadow-sm ${opt.color}`}></span>
                       {opt.label}
                     </button>
                   ))}
                 </div>
                 {colorFilter && (
                   <div className="border-t border-gray-100 dark:border-slate-800 mt-2 pt-2">
                      <button onClick={() => { setColorFilter(null); setIsColorMenuOpen(false); }} className="w-full text-center px-3 py-2 text-[10px] text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors uppercase tracking-tight">
                        Effacer le filtre couleur
                      </button>
                   </div>
                 )}
               </div>
             )}
          </div>

          <button 
            onClick={() => setIsColorSorted(!isColorSorted)}
            className={`flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 px-4 py-2 border rounded-xl shadow-sm text-xs font-bold transition-all duration-200 active:scale-95 ${isColorSorted ? 'bg-orange-500 border-orange-500 text-white hover:bg-orange-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            title="Trier par urgence couleur"
          >
            <ArrowUpDown className="w-4 h-4" />
            <span>Tri</span>
          </button>

          <div className="h-6 w-px bg-gray-200 dark:bg-slate-800 mx-1 hidden lg:block"></div>

          <div className="relative flex-grow sm:flex-grow-0" ref={columnMenuRef}>
            <button 
              onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 active:scale-95"
            >
              <Columns className="w-4 h-4 text-indigo-600" />
              <span>Colonnes</span>
            </button>
            {isColumnMenuOpen && (
              <div className="absolute right-0 mt-2 w-[290px] sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] z-50 max-h-[70vh] flex flex-col animate-in zoom-in-95 origin-top-right">
                 <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 flex flex-col gap-3 sticky top-0 z-10 rounded-t-2xl">
                   <div className="flex justify-between items-center">
                    <span className="font-black text-gray-800 dark:text-slate-200 text-sm tracking-tight uppercase">Configuration de vue</span>
                    <div className="flex gap-4 text-[10px] font-black uppercase">
                       <button onClick={() => setAllColumns(true)} className="text-indigo-600 dark:text-indigo-400 hover:underline">Tout</button>
                       <button onClick={() => setAllColumns(false)} className="text-indigo-600 dark:text-indigo-400 hover:underline">Rien</button>
                    </div>
                   </div>
                 </div>
                 <div className="p-3 space-y-1 overflow-y-auto">
                  {COLUMNS.map(col => (
                    <label key={col} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${visibleColumns[col] !== false ? 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-slate-200' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-indigo-600 rounded-md border-gray-300 dark:border-slate-700 focus:ring-indigo-500" 
                        checked={visibleColumns[col] !== false} 
                        onChange={() => toggleColumn(col)} 
                      />
                      <span className="text-xs font-bold truncate">{col}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      <div className="overflow-auto flex-1 relative scrollbar-thin scrollbar-thumb-indigo-100 scrollbar-track-transparent">
        <table className="min-w-max w-full text-xs text-left border-collapse pb-40">
          <thead className="bg-slate-900 dark:bg-slate-950 text-slate-100 font-black uppercase tracking-wider sticky top-0 z-20 shadow-[0_4px_16px_rgba(0,0,0,0.2)] border-b-2 border-slate-950">
            <tr>
              <th className="px-3 py-4 border-r border-slate-800 w-12 bg-slate-900 dark:bg-slate-950 sticky left-0 z-30 text-center text-slate-400 font-black">#</th>
              {activeColumns.map(col => {
                const isDateCol = DATE_COLUMNS.includes(col);
                const filterVal = filters[col] || "";
                const isFiltered = !!filterVal;
                let startVal = "";
                let endVal = "";
                if (isDateCol && filterVal.startsWith("DATE_RANGE|")) {
                  const parts = filterVal.split("|");
                  startVal = parts[1] || "";
                  endVal = parts[2] || "";
                }
                return (
                  <th key={col} className="px-5 py-4 border-r border-slate-800 min-w-[190px] whitespace-nowrap bg-slate-900 dark:bg-slate-950 align-top group">
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-xs uppercase tracking-wider text-slate-100 dark:text-slate-100">{col}</span>
                        <div className="relative">
                          <button 
                            onClick={() => setActiveColAction(activeColAction === col ? null : col)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-slate-800 rounded-lg text-slate-400"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {activeColAction === col && (
                            <div ref={colActionRef} className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 py-2 animate-in zoom-in-95 origin-top-right">
                              <button 
                                onClick={() => copyColumn(col)}
                                className="w-full text-left px-4 py-2.5 text-xs hover:bg-indigo-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors text-slate-700 dark:text-slate-200 font-black"
                              >
                                <Copy className="w-4 h-4 text-indigo-600" /> <span>Copier le contenu</span>
                              </button>
                              {canEdit && (
                                <button 
                                  onClick={() => pasteColumn(col)}
                                  className="w-full text-left px-4 py-2.5 text-xs hover:bg-indigo-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors text-slate-700 dark:text-slate-200 font-black"
                                >
                                  <ClipboardPaste className="w-4 h-4 text-indigo-600" /> <span>Coller valeurs</span>
                                </button>
                              )}
                              <div className="border-t my-2 border-slate-100 dark:border-slate-800"></div>
                              {canEdit && (
                                <button 
                                  onClick={() => deleteColumn(col)}
                                  className="w-full text-left px-4 py-2.5 text-xs hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 flex items-center gap-3 transition-colors font-black"
                                >
                                  <Trash2 className="w-4 h-4" /> <span>Supprimer colonne</span>
                                </button>
                              )}
                              <button 
                                onClick={() => toggleColumn(col)}
                                className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 flex items-center gap-3 transition-colors font-black"
                              >
                                <XCircle className="w-4 h-4" /> <span>Masquer colonne</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {isDateCol ? (
                        <div className="relative">
                          <button 
                            onClick={() => setActiveDateFilterCol(activeDateFilterCol === col ? null : col)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-[11px] border-2 rounded-xl transition-all ${isFiltered ? 'bg-indigo-600 border-indigo-600 text-white font-black shadow-xs' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 font-bold hover:border-indigo-400'}`}
                          >
                            <span className="truncate">{isFiltered ? "Période active" : "Filtrer par date..."}</span>
                            <CalendarRange className={`w-3.5 h-3.5 ml-1 flex-shrink-0 ${isFiltered ? 'text-white' : 'text-slate-400'}`} />
                          </button>
                          {activeDateFilterCol === col && (
                            <div ref={dateFilterRef} className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-4 animate-in zoom-in-95 origin-top-left">
                              <div className="flex flex-col gap-4">
                                <h4 className="font-black text-slate-900 dark:text-slate-100 text-xs uppercase tracking-tight">Filtrer l'intervalle</h4>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Du</label>
                                    <input 
                                      type="date" 
                                      className="border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-xs w-full focus:border-indigo-500 outline-none text-slate-900 dark:text-slate-100 font-black" 
                                      defaultValue={startVal} 
                                      id={`start-${col}`} 
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Au</label>
                                    <input 
                                      type="date" 
                                      className="border-2 border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-xs w-full focus:border-indigo-500 outline-none text-slate-900 dark:text-slate-100 font-black" 
                                      defaultValue={endVal} 
                                      id={`end-${col}`} 
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-between mt-1 pt-3 border-t border-slate-100 dark:border-slate-800">
                                  <button 
                                    onClick={() => handleDateFilterApply(col, "", "")} 
                                    className="text-xs font-black text-red-500 hover:underline"
                                  >
                                    Reset
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const s = (document.getElementById(`start-${col}`) as HTMLInputElement).value;
                                      const e = (document.getElementById(`end-${col}`) as HTMLInputElement).value;
                                      handleDateFilterApply(col, s, e);
                                    }} 
                                    className="text-xs font-black bg-indigo-600 text-white px-5 py-2 rounded-xl shadow-md hover:bg-indigo-700 transition-colors"
                                  >
                                    Appliquer
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <input 
                            type="text" 
                            placeholder="Rechercher..." 
                            className={`w-full pl-9 pr-8 py-2 text-[11px] border-2 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all ${isFiltered ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-black' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-black placeholder:text-slate-400'}`} 
                            value={filterVal} 
                            onChange={e => onFilterChange(col, e.target.value)} 
                          />
                          <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isFiltered ? 'text-indigo-600' : 'text-slate-400'}`} />
                          {isFiltered && (
                            <button 
                              onClick={() => onFilterChange(col, "")} 
                              className="absolute right-2 top-2.5 text-indigo-500 hover:text-red-500 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
            {paginatedData.map((row) => {
              const globalIdx = data.indexOf(row);
              return (
                <tr key={globalIdx} className={`transition-all duration-150 group border-l-4 border-l-transparent hover:bg-indigo-50/70 dark:hover:bg-slate-800/80 ${getRowColorClass(row["X"])}`}>
                  <td className="px-2 py-3 border-r border-slate-200/60 dark:border-slate-800 bg-inherit sticky left-0 z-10 text-center w-12 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">
                    <div className="relative">
                      {canEdit && (
                        <button 
                          onClick={() => setActiveRowActionIndex(activeRowActionIndex === globalIdx ? null : globalIdx)} 
                          className="p-1.5 hover:bg-black/5 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      )}
                      {activeRowActionIndex === globalIdx && canEdit && (
                        <div ref={rowActionRef} className="absolute left-full top-0 ml-2 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 py-2 text-left animate-in fade-in slide-in-from-left-2 duration-200">
                          <button 
                            onClick={() => copyRow(row)} 
                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-indigo-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors text-slate-800 dark:text-slate-200 font-black"
                          >
                            <Copy className="w-4 h-4 text-indigo-600" /> <span>Copier la ligne</span>
                          </button>
                          <button 
                            onClick={() => deleteRow(row)} 
                            className="w-full text-left px-4 py-2.5 text-xs hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 flex items-center gap-3 transition-colors font-black"
                          >
                            <Trash2 className="w-4 h-4" /> <span>Supprimer</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  {activeColumns.map(col => {
                    const colLower = col.toLowerCase();
                    const isCodeOrIdCol = colLower.includes("swo") || colLower.includes("fit") || colLower.includes("id") || colLower === "x";

                    if (col === "State SWO" || col === "X" || col === "status" || col === "Statuts") {
                      const options = (col === "State SWO" || col === "status") ? SWO_OPTIONS : X_OPTIONS;
                      return (
                        <td key={`${globalIdx}-${col}`} className={`px-4 py-3 ${getColumnBgClass(col)}`}>
                          <select 
                            className="bg-white/80 dark:bg-slate-800 text-black dark:text-slate-100 text-xs font-black px-2.5 py-1 rounded-lg w-full cursor-pointer transition-all border border-slate-300 dark:border-slate-700 focus:border-indigo-600 outline-none disabled:opacity-50 uppercase shadow-2xs" 
                            value={String(row[col] || "").trim()} 
                            onChange={e => onUpdateRow(globalIdx, col, e.target.value)} 
                            disabled={!canEdit}
                          >
                            <option value="">- Vide -</option>
                            {options.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </td>
                      );
                    }
                    if (DATE_COLUMNS.includes(col)) {
                      const formatted = formatDateTime(row[col]);
                      return (
                        <td key={`${globalIdx}-${col}`} className={`px-4 py-3 ${getColumnBgClass(col)} whitespace-nowrap`}>
                          <input 
                            type="text" 
                            className="w-full h-full bg-transparent border-none text-xs font-mono font-black text-black dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/50 rounded-md py-1 px-1 disabled:opacity-50" 
                            value={formatted} 
                            onChange={e => onUpdateRow(globalIdx, col, e.target.value)} 
                            disabled={!canEdit} 
                          />
                        </td>
                      );
                    }
                    if (isCodeOrIdCol) {
                      const valStr = row[col] !== undefined && row[col] !== null ? String(row[col]) : "";
                      return (
                        <td key={`${globalIdx}-${col}`} className={`px-4 py-3 ${getColumnBgClass(col)} whitespace-nowrap`}>
                          <input 
                            type="text" 
                            className="w-full bg-white/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-black dark:text-indigo-300 text-xs font-mono font-black rounded-lg py-1 px-2 focus:ring-2 focus:ring-indigo-500/50 outline-none disabled:opacity-50 shadow-2xs" 
                            value={valStr} 
                            onChange={e => onUpdateRow(globalIdx, col, e.target.value)} 
                            disabled={!canEdit} 
                          />
                        </td>
                      );
                    }
                    return (
                      <td key={`${globalIdx}-${col}`} className={`px-4 py-3 ${getColumnBgClass(col)} whitespace-nowrap overflow-hidden text-ellipsis max-w-xs`}>
                        <input 
                          type="text" 
                          className="w-full h-full bg-transparent border-none text-xs font-black text-black dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/50 rounded-md py-1 px-1 disabled:opacity-50" 
                          value={row[col] !== undefined && row[col] !== null ? String(row[col]) : ""} 
                          onChange={e => onUpdateRow(globalIdx, col, e.target.value)} 
                          disabled={!canEdit} 
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={activeColumns.length + 1} className="text-center py-24 text-gray-400">
                  <div className="flex flex-col items-center gap-4">
                    <Search className="w-12 h-12 opacity-10" />
                    <p className="font-bold text-sm">Aucun résultat trouvé pour votre recherche.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="h-16 pointer-events-none" />
      </div>

      {/* Pinned Pagination Footer */}
      <div className="px-4 py-2 border-t bg-gray-50/80 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Affichage de {filteredData.length === 0 ? 0 : Math.min(filteredData.length, (currentPage - 1) * rowsPerPage + 1)}-{Math.min(filteredData.length, currentPage * rowsPerPage)} sur {filteredData.length} records
        </div>
        
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setCurrentPage(1)} 
            disabled={currentPage === 1}
            className="p-1.5 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
            disabled={currentPage === 1}
            className="p-1.5 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          
          <div className="flex items-center gap-1 px-2">
            <span className="text-xs font-black text-gray-400">Page</span>
            <span className="text-xs font-black text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-md min-w-[26px] text-center">{currentPage}</span>
            <span className="text-xs font-black text-gray-400">sur {totalPages || 1}</span>
          </div>

          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-1.5 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setCurrentPage(totalPages)} 
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-1.5 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};