
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, Filter, CheckCircle, Loader2 } from 'lucide-react';
import { GlobalFileRow } from '../types';
import { COLUMNS } from '../constants';

interface ExportManagerProps {
  allData: GlobalFileRow[];
  filteredData: GlobalFileRow[];
  onImport: (data: GlobalFileRow[]) => void;
  isAdmin?: boolean;
}

export const ExportManager: React.FC<ExportManagerProps> = ({ allData, filteredData, onImport, isAdmin }) => {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as GlobalFileRow[];
        onImport(data);
      } catch (error) {
        console.error("Import failed", error);
        alert("Une erreur est survenue lors de l'import.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExport = (data: GlobalFileRow[], type: 'GLOBAL' | 'FILTRÉ') => {
    setIsExporting(type);
    
    // Petite pause pour laisser le loader s'afficher
    setTimeout(() => {
      try {
        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `GLOBAL_FILES_${type}_${timestamp}.xlsx`;
        
        // Préparation des données pour s'assurer que l'ordre des colonnes est respecté
        const exportData = data.map(row => {
          const orderedRow: { [key: string]: string | number | boolean | null | undefined } = {};
          COLUMNS.forEach(col => {
            orderedRow[col] = row[col] ?? "";
          });
          return orderedRow;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Ajustement automatique de la largeur des colonnes
        const maxWidths = COLUMNS.map(col => ({ wch: Math.max(col.length, 15) }));
        ws['!cols'] = maxWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        
        XLSX.writeFile(wb, fileName);
      } catch (error) {
        console.error("Export failed", error);
        alert("Une erreur est survenue lors de l'export.");
      } finally {
        setIsExporting(null);
      }
    }, 500);
  };

  return (
    <div className="p-6 md:p-12 bg-gray-50 min-h-full flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Download className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Centre d'Exportation</h2>
          <p className="text-gray-500 font-medium">Téléchargez vos données au format Microsoft Excel (.xlsx)</p>
        </div>

        <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-8 mt-12 max-w-5xl mx-auto`}>
          {/* Carte Import - ADMIN ONLY */}
          {isAdmin && (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:shadow-xl hover:border-indigo-200 transition-all duration-300">
              <div className="bg-emerald-50 p-5 rounded-2xl mb-6 group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-2">Importer Données</h3>
              <p className="text-sm text-gray-400 mb-8 leading-relaxed">Charger un fichier Excel pour mettre à jour Row Data.</p>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
              >
                {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
                CHOISIR LE FICHIER
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImport} 
                accept=".xlsx,.xls" 
                className="hidden" 
              />
            </div>
          )}

          {/* Carte Export Global */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:shadow-xl hover:border-indigo-200 transition-all duration-300">
            <div className="bg-blue-50 p-5 rounded-2xl mb-6 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-2">Export Complet</h3>
            <p className="text-sm text-gray-400 mb-8 leading-relaxed">Télécharger l'intégralité de Row Data sans aucun filtre appliqué.</p>
            
            <div className="mt-auto w-full">
              <div className="flex justify-between items-center mb-4 px-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total lignes</span>
                <span className="text-sm font-black text-blue-600">{allData.length}</span>
              </div>
              <button 
                onClick={() => handleExport(allData, 'GLOBAL')}
                disabled={!!isExporting}
                className="w-full py-4 bg-gray-900 hover:bg-blue-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
              >
                {isExporting === 'GLOBAL' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                GÉNÉRER LE FICHIER
              </button>
            </div>
          </div>

          {/* Carte Export Filtré */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:shadow-xl hover:border-indigo-200 transition-all duration-300">
            <div className="bg-indigo-50 p-5 rounded-2xl mb-6 group-hover:scale-110 transition-transform">
              <Filter className="w-10 h-10 text-indigo-600" />
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-2">Export Sélection</h3>
            <p className="text-sm text-gray-400 mb-8 leading-relaxed">Télécharger uniquement les données correspondant aux filtres actifs dans l'onglet Données.</p>
            
            <div className="mt-auto w-full">
              <div className="flex justify-between items-center mb-4 px-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lignes filtrées</span>
                <span className="text-sm font-black text-indigo-600">{filteredData.length}</span>
              </div>
              <button 
                onClick={() => handleExport(filteredData, 'FILTRÉ')}
                disabled={!!isExporting || filteredData.length === 0}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:bg-gray-200"
              >
                {isExporting === 'FILTRÉ' ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                EXPORTER LA SÉLECTION
              </button>
            </div>
          </div>
        </div>

        <div className="bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden mt-12">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <h4 className="text-lg font-black uppercase">Besoin d'un rapport spécifique ?</h4>
              <p className="text-indigo-200 text-sm">Utilisez les onglets GM ou TTF pour des captures visuelles (JPG) des graphiques.</p>
            </div>
            <div className="flex gap-4">
               <div className="flex flex-col items-center">
                  <span className="text-2xl font-black">{COLUMNS.length}</span>
                  <span className="text-[10px] font-bold uppercase text-indigo-300">Colonnes</span>
               </div>
               <div className="w-px h-10 bg-indigo-700"></div>
               <div className="flex flex-col items-center">
                  <span className="text-2xl font-black">.xlsx</span>
                  <span className="text-[10px] font-bold uppercase text-indigo-300">Format</span>
               </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-800 rounded-full -mr-32 -mt-32 opacity-50"></div>
        </div>
      </div>
    </div>
  );
};
