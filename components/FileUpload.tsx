
import React, { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Loader2, Database, ListPlus, X } from 'lucide-react';
import { GlobalFileRow } from '../types';
import { normalizeRow } from '../utils/dataNormalization';

interface FileUploadProps {
  onDataLoaded: (data: GlobalFileRow[], append: boolean) => void;
  existingDataCount: number;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, existingDataCount, className = "" }) => {
  const [loading, setLoading] = useState(false);
  const [pendingData, setPendingData] = useState<GlobalFileRow[] | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const processFile = useCallback((file: File) => {
    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("No data found");
        
        const workbook = XLSX.read(new Uint8Array(data as ArrayBuffer), { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const rawData = XLSX.utils.sheet_to_json(sheet) as GlobalFileRow[];
        const sanitizedData = rawData.map(row => normalizeRow(row));
        
        if (existingDataCount > 0) {
          setPendingData(sanitizedData);
        } else {
          onDataLoaded(sanitizedData, true);
        }
      } catch (error) {
        console.error("Error parsing file", error);
        alert("Erreur lors de la lecture du fichier Excel. Vérifiez le format.");
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  }, [onDataLoaded, existingDataCount]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };

  return (
    <div className={`w-full max-w-2xl relative ${className}`}>
      {/* Modal de choix si données existantes */}
      {pendingData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full border border-indigo-50 animate-in zoom-in-95">
            <div className="flex justify-between items-start mb-6">
              <div className="bg-indigo-100 p-3 rounded-2xl">
                <Database className="w-6 h-6 text-indigo-600" />
              </div>
              <button onClick={() => setPendingData(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">Importation de données</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Le fichier contient <span className="font-bold text-indigo-600">{pendingData.length} lignes</span>. 
              Un jeu de Row Data de <span className="font-bold text-slate-800">{existingDataCount} lignes</span> existe déjà.
              Les lignes existantes correspondantes seront mises à jour et les nouvelles lignes seront insérées.
            </p>

            <div className="space-y-3">
              <button 
                onClick={() => { onDataLoaded(pendingData, true); setPendingData(null); }}
                className="w-full flex items-center justify-between p-4 bg-indigo-600 hover:bg-indigo-700 border border-indigo-700 rounded-2xl text-white transition-all group shadow-lg shadow-indigo-100"
              >
                <div className="flex items-center gap-3">
                  <ListPlus className="w-5 h-5 text-white" />
                  <div className="text-left">
                    <p className="text-sm font-black uppercase tracking-tight">Mettre à jour & Fusionner</p>
                    <p className="text-[10px] text-indigo-200 font-bold uppercase">Remplacer l'existant & ajouter les nouveautés</p>
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full bg-indigo-500/50 flex items-center justify-center group-hover:bg-white group-hover:text-indigo-600 transition-colors">
                  <span className="text-sm font-bold">→</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        className={`w-full p-12 border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center transition-all duration-300
          ${dragActive ? 'border-indigo-500 bg-indigo-50 scale-[1.02] shadow-2xl shadow-indigo-100' : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-xl shadow-sm'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {loading ? (
          <div className="flex flex-col items-center text-indigo-600 py-12">
            <div className="relative mb-6">
              <Loader2 className="w-16 h-16 animate-spin" />
              <FileSpreadsheet className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-lg font-black uppercase tracking-widest animate-pulse">Extraction de l'intelligence...</p>
          </div>
        ) : (
          <>
            <div className="bg-indigo-50 p-6 rounded-[2rem] mb-6 shadow-inner transition-transform group-hover:scale-110">
              <FileSpreadsheet className="w-16 h-16 text-indigo-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tighter">Charger le Global File</h3>
            <p className="text-slate-400 text-center mb-10 max-w-sm font-medium leading-relaxed">
              Glissez votre fichier <span className="text-indigo-600 font-bold">.xlsx</span> ici ou utilisez le bouton pour mettre à jour vos indicateurs.
            </p>
            
            <label className="relative cursor-pointer bg-slate-900 text-white px-10 py-5 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl hover:shadow-indigo-200 active:scale-95 flex items-center gap-3 font-black text-sm uppercase tracking-widest">
              <Upload className="w-5 h-5" />
              <span>Parcourir</span>
              <input 
                type="file" 
                className="hidden" 
                accept=".xlsx, .xls, .csv"
                onChange={handleChange}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
};
