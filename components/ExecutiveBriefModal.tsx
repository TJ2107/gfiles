import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileCheck, Download, X, CheckCircle2, 
  Clock, Users, Building2, TrendingUp
} from 'lucide-react';
import { GlobalFileRow } from '../types';
import * as XLSX from 'xlsx';

interface ExecutiveBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: GlobalFileRow[];
}

export const ExecutiveBriefModal: React.FC<ExecutiveBriefModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'xlsx' | 'json'>('xlsx');

  // Compute key executive metrics from current global rows
  const stats = useMemo(() => {
    let closedCount = 0;
    let pendingCount = 0;
    const totalSwo = data.length;
    const feSet = new Set<string>();
    const siteSet = new Set<string>();

    data.forEach(row => {
      const state = String(row["TAS Status"] || row["x-Value"] || '').toUpperCase();
      if (state.includes('CLOSED') || state.includes('CLOSE') || state.includes('FERMÉ')) {
        closedCount++;
      } else {
        pendingCount++;
      }

      const fe = row["Assigned to"] || row["Intervenant"] || row["FE names"];
      if (fe && String(fe).trim() !== '-' && String(fe).toLowerCase() !== 'none') {
        feSet.add(String(fe).trim().toLowerCase());
      }

      const site = row["Nom du site"] || row["ID"];
      if (site && String(site).trim() !== '') {
        siteSet.add(String(site).trim().toLowerCase());
      }
    });

    const completionRate = totalSwo > 0 ? Math.round((closedCount / totalSwo) * 100) : 0;

    return {
      totalSwo,
      closedCount,
      pendingCount,
      completionRate,
      activeFEs: feSet.size,
      totalSites: siteSet.size,
      generatedAt: new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  }, [data]);

  const handleExportBrief = () => {
    if (selectedFormat === 'xlsx') {
      const summarySheetData = [
        { Metric: 'Total SWO Enregistrés', Valeur: stats.totalSwo },
        { Metric: 'SWO Clôturés (FERMÉ/CLOSED)', Valeur: stats.closedCount },
        { Metric: 'SWO En Cours / Ouverts', Valeur: stats.pendingCount },
        { Metric: 'Taux de Clôture Globale', Valeur: `${stats.completionRate}%` },
        { Metric: 'Techniciens Actifs (FE)', Valeur: stats.activeFEs },
        { Metric: 'Sites Uniques Identifiés', Valeur: stats.totalSites },
        { Metric: 'Date de Génération du Rapport', Valeur: stats.generatedAt }
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(summarySheetData);
      XLSX.utils.book_append_sheet(wb, ws, "Executive_Summary");
      XLSX.writeFile(wb, `Rapport_Executif_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(stats, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `Executive_Brief_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10"
          id="executive-brief-modal"
        >
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-start justify-between border-b border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 shadow-inner text-indigo-400">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">
                    Rapport Synthèse Exécutive
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                    IA Synthèse
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 font-medium">
                  Rapport de performance consolidé pour les décideurs
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Volume Total SWO</span>
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.totalSwo}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Tickets enregistrés</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Taux de Clôture</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.completionRate}%</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{stats.closedCount} résolus sur {stats.totalSwo}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider">Tickets En Cours</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{stats.pendingCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Nécessite une intervention</p>
              </div>
            </div>

            {/* Field & Coverage Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                <div className="p-3 rounded-xl bg-indigo-600 text-white shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Techniciens FE Actifs</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">{stats.activeFEs} FE</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
                <div className="p-3 rounded-xl bg-slate-800 text-white shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Sites Couverts</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">{stats.totalSites} Sites</p>
                </div>
              </div>
            </div>

            {/* Format Selection */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
              <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 block mb-2">
                Format d'Exportation Exécutif
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFormat('xlsx')}
                  className={`p-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-2 transition-all ${
                    selectedFormat === 'xlsx'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFormat('json')}
                  className={`p-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-2 transition-all ${
                    selectedFormat === 'json'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  JSON (.json)
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400">
              Généré le {stats.generatedAt}
            </span>

            <button
              onClick={handleExportBrief}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" /> Télécharger le Rapport
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
