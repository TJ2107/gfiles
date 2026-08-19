import React, { useState, useMemo, useRef } from 'react';
import { GlobalFileRow, XStatus } from '../types';
import { COLUMNS, X_OPTIONS } from '../constants';
import { parseDate } from '../utils/dateHelpers';
import * as XLSX from 'xlsx';
import { 
  Search, 
  Filter, 
  Table, 
  LayoutGrid, 
  Columns, 
  Download, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Eye, 
  X, 
  Edit3, 
  Save, 
  Copy, 
  Check, 
  Layers, 
  MapPin, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  FilterX, 
  ListFilter
} from 'lucide-react';

interface DataExplorerProps {
  data: GlobalFileRow[];
  setData: React.Dispatch<React.SetStateAction<GlobalFileRow[]>>;
  onUpdateRow: (index: number, field: string, value: string) => void;
  filters: Record<string, string>;
  onFilterChange: (column: string, value: string) => void;
  onApplyFilters: (filters: Record<string, string>) => void;
  onSaveDatabase?: () => void;
  canEdit?: boolean;
}

// Default columns to display initially for optimal clarity
const DEFAULT_VISIBLE_COLUMNS = [
  "N° SWO",
  "Nom du site",
  "Region",
  "X",
  "State SWO",
  "Date de création du SWO",
  "Closing date",
  "Intervenant",
  "Assigned to",
  "Description"
];

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

const formatDateTime = (val: string | number | Date | null | undefined): string => {
  const d = parseDate(val);
  if (!d) return typeof val === 'string' ? val : (val ? String(val) : '');
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export const DataExplorer: React.FC<DataExplorerProps> = ({
  data,
  onUpdateRow,
  filters = {},
  onSaveDatabase,
  canEdit = true
}) => {
  // Local state for search & fluid view
  const [globalSearch, setGlobalSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'kanban'>('table');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedStatusX, setSelectedStatusX] = useState<string>('ALL');
  const [quickPreset, setQuickPreset] = useState<'ALL' | 'OPEN' | 'CLOSED' | 'HTC'>('ALL');
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showMobilePagination, setShowMobilePagination] = useState(true);
  const lastScrollTopRef = useRef(0);

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScroll = e.currentTarget.scrollTop;
    if (currentScroll > lastScrollTopRef.current + 8 && currentScroll > 15) {
      setShowMobilePagination(false);
    } else if (currentScroll < lastScrollTopRef.current - 8 || currentScroll <= 10) {
      setShowMobilePagination(true);
    }
    lastScrollTopRef.current = currentScroll;
  };

  // Detail Drawer state
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [isEditingRow, setIsEditingRow] = useState(false);
  const [editedRowData, setEditedRowData] = useState<GlobalFileRow | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Extract distinct regions for quick selector
  const regions = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    const set = new Set<string>();
    data.forEach(row => {
      const reg = row["Region"] ? String(row["Region"]).trim() : '';
      if (reg && reg !== 'Non défini') set.add(reg);
    });
    return Array.from(set).sort();
  }, [data]);

  // All available columns in data
  const allAvailableColumns = useMemo(() => {
    if (!data || data.length === 0) return COLUMNS;
    const keySet = new Set<string>();
    COLUMNS.forEach(c => keySet.add(c));
    data.slice(0, 100).forEach(row => {
      if (row) {
        Object.keys(row).forEach(k => {
          if (k && !k.startsWith('_')) keySet.add(k);
        });
      }
    });
    return Array.from(keySet);
  }, [data]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    return data.map((row, originalIndex) => ({ row, originalIndex })).filter(({ row }) => {
      if (!row) return false;

      // 1. Quick Presets
      const xStatus = String(row["X"] || "").trim();
      if (quickPreset === 'OPEN') {
        if (xStatus !== XStatus.TVX_STHIC && xStatus !== XStatus.STHIC_SPA) return false;
      } else if (quickPreset === 'CLOSED') {
        if (xStatus !== XStatus.CLOSED) return false;
      } else if (quickPreset === 'HTC') {
        if (!xStatus.includes('HTC')) return false;
      }

      // 2. Region Dropdown
      if (selectedRegion !== 'ALL') {
        const reg = String(row["Region"] || "").trim();
        if (reg !== selectedRegion) return false;
      }

      // 3. Status X Dropdown
      if (selectedStatusX !== 'ALL') {
        if (xStatus !== selectedStatusX) return false;
      }

      // 4. Existing Global App Filters
      if (filters && Object.keys(filters).length > 0) {
        for (const [col, val] of Object.entries(filters)) {
          if (!val) continue;
          const cellVal = String(row[col] || "").toLowerCase();
          if (!cellVal.includes(val.toLowerCase())) return false;
        }
      }

      // 5. Local Search input
      if (globalSearch.trim()) {
        const searchLower = globalSearch.toLowerCase().trim();
        const searchableText = [
          row["N° SWO"],
          row["Nom du site"],
          row["Region"],
          row["X"],
          row["State SWO"],
          row["Intervenant"],
          row["Assigned to"],
          row["Description"],
          row["Short description"]
        ].map(v => String(v || '')).join(' ').toLowerCase();

        if (!searchableText.includes(searchLower)) return false;
      }

      return true;
    });
  }, [data, quickPreset, selectedRegion, selectedStatusX, filters, globalSearch]);

  // Sorted dataset
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;

    return [...filteredData].sort((a, b) => {
      const valA = String(a.row[sortColumn] || '').toLowerCase();
      const valB = String(b.row[sortColumn] || '').toLowerCase();

      // Check if dates
      const dateA = parseDate(valA);
      const dateB = parseDate(valB);
      if (dateA && dateB) {
        return sortDirection === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      }

      // Check numeric
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Paginated dataset
  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Handle Sort Toggle
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Toggle Column Visibility
  const toggleColumnVisibility = (colName: string) => {
    setVisibleColumns(prev => 
      prev.includes(colName) ? prev.filter(c => c !== colName) : [...prev, colName]
    );
  };

  // Export current filtered dataset to XLSX
  const handleExportXLSX = () => {
    const exportRows = filteredData.map(item => item.row);
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Données Exportées");
    XLSX.writeFile(wb, `Export_Data_Pro_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Open detail drawer
  const handleOpenRowDetail = (index: number) => {
    setSelectedRowIndex(index);
    setEditedRowData({ ...data[index] });
    setIsEditingRow(false);
  };

  // Save row edits
  const handleSaveRowEdit = () => {
    if (selectedRowIndex === null || !editedRowData) return;
    Object.entries(editedRowData).forEach(([field, val]) => {
      onUpdateRow(selectedRowIndex, field, String(val ?? ''));
    });
    if (onSaveDatabase) onSaveDatabase();
    setIsEditingRow(false);
  };

  // Status Badge Helper
  const renderStatusBadge = (statusX: string) => {
    const x = String(statusX || '').trim();
    if (x === XStatus.CLOSED) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> CLOSED
        </span>
      );
    }
    if (x === XStatus.TVX_STHIC || x === XStatus.STHIC_SPA) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
          <Clock className="w-3 h-3 text-indigo-600" /> {x}
        </span>
      );
    }
    if (x.includes('HTC')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
          <AlertTriangle className="w-3 h-3 text-amber-600" /> {x}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
        {x || 'N/A'}
      </span>
    );
  };

  // Grouped Kanban Data
  const kanbanGroups = useMemo(() => {
    const groups: Record<string, { row: GlobalFileRow; originalIndex: number }[]> = {
      'CLOSED': [],
      'TVX / SPA En Cours': [],
      'HTC / Urgences': [],
      'Autres Statuts': []
    };

    filteredData.forEach(item => {
      const x = String(item.row["X"] || '').trim();
      if (x === XStatus.CLOSED) {
        groups['CLOSED'].push(item);
      } else if (x === XStatus.TVX_STHIC || x === XStatus.STHIC_SPA) {
        groups['TVX / SPA En Cours'].push(item);
      } else if (x.includes('HTC')) {
        groups['HTC / Urgences'].push(item);
      } else {
        groups['Autres Statuts'].push(item);
      }
    });

    return groups;
  }, [filteredData]);

  return (
    <div onScroll={handleContainerScroll} className="flex flex-col min-h-full h-full bg-slate-50/50 space-y-2.5 sm:space-y-3 lg:space-y-4 p-2 sm:p-3 lg:p-6 overflow-y-auto lg:overflow-hidden w-full max-w-full relative">
      
      {/* 1. TOP SUMMARY & ACTION BAR */}
      <div className="bg-white p-2.5 sm:p-3.5 lg:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-4 w-full">
        
        {/* Left Title & Key Stats */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-200 shrink-0">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Data Pro & Explorer</h2>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                Vue Fluid
              </span>
            </div>
            <p className="hidden sm:block text-xs font-medium text-slate-500 mt-0.5">
              Affichage fluide, recherche instantanée et édition directe sur <span className="font-bold text-slate-800">{totalItems}</span> enregistrements.
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 overflow-x-auto w-full lg:w-auto scrollbar-none">
          <button 
            onClick={() => { setQuickPreset('ALL'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${quickPreset === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Tous ({data.length})
          </button>
          <button 
            onClick={() => { setQuickPreset('OPEN'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${quickPreset === 'OPEN' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Ouverts (TVX/SPA)
          </button>
          <button 
            onClick={() => { setQuickPreset('CLOSED'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${quickPreset === 'CLOSED' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Clôturés
          </button>
          <button 
            onClick={() => { setQuickPreset('HTC'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${quickPreset === 'HTC' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            HTC / Urgences
          </button>
        </div>

        {/* Right Tools: View Mode, Export, Columns */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full lg:w-auto">
          
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
            <button 
              onClick={() => setViewMode('table')} 
              title="Vue Tableau Fluid"
              className={`p-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Table className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('grid')} 
              title="Vue Cartes / Grille"
              className={`p-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('kanban')} 
              title="Vue Kanban par Statut"
              className={`p-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'kanban' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <ListFilter className="w-4 h-4" />
            </button>
          </div>

          {/* Column selector toggle */}
          <div className="relative">
            <button 
              onClick={() => setShowColumnPicker(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold border transition-all ${showColumnPicker ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <Columns className="w-4 h-4" />
              <span className="hidden sm:inline">Colonnes ({visibleColumns.length})</span>
            </button>

            {/* Column Picker Modal Popover */}
            {showColumnPicker && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-3xl shadow-2xl border border-slate-200 p-4 z-50 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Colonnes Visibles</span>
                  <button onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)} className="text-[10px] text-indigo-600 font-bold hover:underline">Réinitialiser</button>
                </div>
                <div className="space-y-1">
                  {allAvailableColumns.map(col => (
                    <label key={col} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.includes(col)}
                        onChange={() => toggleColumnVisibility(col)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate">{col}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export button */}
          <button 
            onClick={handleExportXLSX}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="inline">Exporter</span>
          </button>

        </div>
      </div>

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3 w-full">
        
        {/* Instant Search Bar */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Recherche rapide (SWO, Site, Région, Intervenant, Description...)"
            value={globalSearch}
            onChange={(e) => { setGlobalSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          {globalSearch && (
            <button 
              onClick={() => setGlobalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Region & Status Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-48">
            <select
              value={selectedRegion}
              onChange={(e) => { setSelectedRegion(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">Toutes les Régions</option>
              {regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Status X Filter */}
          <div className="relative flex-1 md:w-48">
            <select
              value={selectedStatusX}
              onChange={(e) => { setSelectedStatusX(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">Tous les Statuts X</option>
              {X_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {(globalSearch || selectedRegion !== 'ALL' || selectedStatusX !== 'ALL' || quickPreset !== 'ALL') && (
            <button 
              onClick={() => {
                setGlobalSearch('');
                setSelectedRegion('ALL');
                setSelectedStatusX('ALL');
                setQuickPreset('ALL');
                setCurrentPage(1);
              }}
              className="p-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-2xl transition border border-slate-200 shrink-0"
              title="Réinitialiser tous les filtres"
            >
              <FilterX className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>

      {/* 3. MAIN CONTENT DISPLAY (Table / Grid / Kanban) */}
      <div className="flex-1 overflow-hidden bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs flex flex-col relative w-full min-h-[400px]">
        
        {viewMode === 'table' && (
          <div onScroll={handleContainerScroll} className="flex-1 overflow-x-auto overflow-y-auto relative custom-scrollbar w-full">
            <table className="w-full text-left border-collapse text-xs min-w-[750px] sm:min-w-[900px]">
              <thead className="bg-slate-900 text-slate-200 sticky top-0 z-20 font-bold uppercase tracking-wider text-[11px] shadow-sm">
                <tr>
                  <th className="px-4 py-3.5 w-12 text-center bg-slate-900 border-r border-slate-800">#</th>
                  <th className="px-4 py-3.5 w-16 text-center bg-slate-900 border-r border-slate-800">Actions</th>
                  {visibleColumns.map(col => (
                    <th 
                      key={col} 
                      onClick={() => handleSort(col)}
                      className="px-4 py-3.5 border-r border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors select-none whitespace-nowrap"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span>{col}</span>
                        <ArrowUpDown className={`w-3 h-3 transition-opacity ${sortColumn === col ? 'opacity-100 text-indigo-400' : 'opacity-30'}`} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 2} className="py-16 text-center text-slate-400">
                      <Filter className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-bounce" />
                      <p className="font-bold text-sm text-slate-600">Aucun enregistrement trouvé</p>
                      <p className="text-xs">Essayez de modifier votre recherche ou de réinitialiser vos filtres.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map(({ row, originalIndex }, idx) => {
                    return (
                      <tr 
                        key={originalIndex}
                        className="hover:bg-indigo-50/40 transition-colors group cursor-pointer"
                        onClick={() => handleOpenRowDetail(originalIndex)}
                      >
                        <td className="px-4 py-3 text-center text-slate-400 font-bold border-r border-slate-100 bg-slate-50/50">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td className="px-3 py-3 text-center border-r border-slate-100" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => handleOpenRowDetail(originalIndex)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 transition"
                            title="Consulter les détails du SWO"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>

                        {visibleColumns.map(col => {
                          const val = row[col];
                          if (col === 'X') {
                            return (
                              <td key={col} className="px-4 py-3 border-r border-slate-100 whitespace-nowrap">
                                {renderStatusBadge(String(val || ''))}
                              </td>
                            );
                          }
                          if (col === 'N° SWO') {
                            return (
                              <td key={col} className="px-4 py-3 border-r border-slate-100 font-black text-indigo-700 whitespace-nowrap">
                                {val || '-'}
                              </td>
                            );
                          }
                          if (col === 'Nom du site') {
                            return (
                              <td key={col} className="px-4 py-3 border-r border-slate-100 font-bold text-slate-900 whitespace-nowrap">
                                {val || '-'}
                              </td>
                            );
                          }
                          if (DATE_COLUMNS.includes(col)) {
                            return (
                              <td key={col} className="px-4 py-3 border-r border-slate-100 whitespace-nowrap text-slate-700 font-medium">
                                {formatDateTime(val) || '-'}
                              </td>
                            );
                          }
                          return (
                            <td key={col} className="px-4 py-3 border-r border-slate-100 truncate max-w-xs text-slate-600">
                              {val !== undefined && val !== null && String(val) !== '' ? String(val) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Card Grid View */}
        {viewMode === 'grid' && (
          <div className="flex-1 overflow-auto p-6 custom-scrollbar">
            {paginatedData.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <p className="font-bold text-sm text-slate-600">Aucun résultat trouvé dans la grille</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedData.map(({ row, originalIndex }) => (
                  <div 
                    key={originalIndex}
                    onClick={() => handleOpenRowDetail(originalIndex)}
                    className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:shadow-xl hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl">
                          {row["N° SWO"] || 'Sans SWO'}
                        </span>
                        {renderStatusBadge(String(row["X"] || ''))}
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {row["Nom du site"] || 'Site non spécifié'}
                      </h4>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Région: <strong className="text-slate-800">{row["Region"] || 'N/A'}</strong></span>
                      </div>

                      {row["Description"] && (
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                          {String(row["Description"])}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDateTime(row["Date de création du SWO"]) || 'Pas de date'}</span>
                      </div>
                      <span className="text-indigo-600 font-bold group-hover:translate-x-0.5 transition-transform">
                        Détails &rarr;
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Kanban Board View */}
        {viewMode === 'kanban' && (
          <div className="flex-1 overflow-auto p-6 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 h-full items-start">
              {Object.entries(kanbanGroups).map(([groupTitle, items]) => (
                <div key={groupTitle} className="bg-slate-50 p-4 rounded-3xl border border-slate-200/80 flex flex-col space-y-3">
                  <div className="flex items-center justify-between px-2 py-1">
                    <h3 className="font-black text-xs uppercase tracking-wider text-slate-700">{groupTitle}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
                      {items.length}
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                    {items.slice(0, 30).map(({ row, originalIndex }) => (
                      <div 
                        key={originalIndex}
                        onClick={() => handleOpenRowDetail(originalIndex)}
                        className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition cursor-pointer space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-600">{row["N° SWO"]}</span>
                          <span className="text-[10px] text-slate-400">{row["Region"]}</span>
                        </div>
                        <p className="font-bold text-xs text-slate-900 line-clamp-1">{row["Nom du site"]}</p>
                        {row["Intervenant"] && (
                          <p className="text-[11px] text-slate-500">Tech: {String(row["Intervenant"])}</p>
                        )}
                      </div>
                    ))}
                    {items.length > 30 && (
                      <p className="text-center text-[10px] text-slate-400 italic">
                        + {items.length - 30} autres éléments
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. PAGINATION FOOTER (Desktop / Tablet) */}
        <div className="hidden sm:flex bg-slate-50 px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 border-t border-slate-200 flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
          <div className="text-xs text-slate-500 font-medium">
            Affichage de <strong className="text-slate-800">{totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> à <strong className="text-slate-800">{Math.min(currentPage * pageSize, totalItems)}</strong> sur <strong className="text-slate-800">{totalItems}</strong> enregistrements
          </div>

          <div className="flex items-center gap-4">
            {/* Page Size Select */}
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span>Lignes par page:</span>
              <select 
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(1)} 
                disabled={currentPage === 1}
                className="p-1.5 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 text-slate-700"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                disabled={currentPage === 1}
                className="p-1.5 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 text-slate-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 text-xs font-bold text-slate-800">
                Page {currentPage} / {totalPages}
              </span>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 text-slate-700"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setCurrentPage(totalPages)} 
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-xl bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 text-slate-700"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* FLOATING MOBILE PAGINATION (Phone format: Auto-hides when scrolling down, reappears when scrolling up) */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 sm:hidden transition-all duration-300 transform ${showMobilePagination ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
        <div className="bg-slate-900/95 text-white backdrop-blur-md px-5 py-2.5 rounded-full shadow-2xl border border-slate-700/80 flex items-center gap-6">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
            disabled={currentPage === 1}
            className="p-2 rounded-full hover:bg-slate-800 disabled:opacity-30 text-white transition active:scale-90"
            aria-label="Feuille précédente"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <span className="text-xs font-black tracking-widest text-slate-200 select-none">
            {currentPage} / {totalPages}
          </span>

          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
            disabled={currentPage === totalPages}
            className="p-2 rounded-full hover:bg-slate-800 disabled:opacity-30 text-white transition active:scale-90"
            aria-label="Feuille suivante"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 5. ROW DETAIL SIDE-DRAWER */}
      {selectedRowIndex !== null && editedRowData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            
            {/* Drawer Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                  Détails du SWO #{editedRowData["N° SWO"] || 'Sans numéro'}
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  {editedRowData["Nom du site"] || 'Site non spécifié'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <button 
                    onClick={() => {
                      if (isEditingRow) {
                        handleSaveRowEdit();
                      } else {
                        setIsEditingRow(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${isEditingRow ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}
                  >
                    {isEditingRow ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                    <span>{isEditingRow ? 'Enregistrer' : 'Éditer'}</span>
                  </button>
                )}
                <button 
                  onClick={() => setSelectedRowIndex(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              {/* Status Header Bar */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Statut X (Priorité)</span>
                  <div className="mt-1">{renderStatusBadge(String(editedRowData["X"] || ''))}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Région</span>
                  <p className="font-bold text-sm text-slate-800">{editedRowData["Region"] || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Intervenant</span>
                  <p className="font-bold text-sm text-slate-800">{editedRowData["Intervenant"] || 'Non assigné'}</p>
                </div>
              </div>

              {/* Editable/Readable Form Grid */}
              <div className="space-y-4">
                <h4 className="font-black text-xs uppercase tracking-wider text-slate-400">Champs Principaux</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {allAvailableColumns.map(col => {
                    const val = editedRowData[col];
                    return (
                      <div key={col} className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight block">
                          {col}
                        </label>
                        {isEditingRow ? (
                          <input 
                            type="text" 
                            value={val !== undefined && val !== null ? String(val) : ''}
                            onChange={(e) => setEditedRowData(prev => prev ? { ...prev, [col]: e.target.value } : null)}
                            className="w-full px-3 py-1.5 bg-slate-50 border border-indigo-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20"
                          />
                        ) : (
                          <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-800 break-words">
                            {DATE_COLUMNS.includes(col)
                              ? (formatDateTime(val) || <span className="text-slate-300 italic">Vide</span>)
                              : (val !== undefined && val !== null && String(val) !== '' ? String(val) : <span className="text-slate-300 italic">Vide</span>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(editedRowData, null, 2));
                  setCopiedSuccess(true);
                  setTimeout(() => setCopiedSuccess(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                {copiedSuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSuccess ? 'Copié en JSON' : 'Copier JSON'}</span>
              </button>

              <button 
                onClick={() => setSelectedRowIndex(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
