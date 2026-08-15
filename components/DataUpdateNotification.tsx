import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Columns, PlusCircle, X, Sparkles, Database, ArrowUpRight } from 'lucide-react';

export interface DataUpdateStats {
  updatedColumnsCount: number; // Nombre de colonnes mises à jour
  addedColumnsCount: number;   // Nombre de colonnes ajoutées nouvellement
  updatedRowsCount?: number;   // Nombre de lignes mises à jour
  addedRowsCount?: number;     // Nombre de nouvelles lignes ajoutées
  totalRows?: number;          // Total de lignes enregistrées
  timestamp?: Date;
}

interface DataUpdateNotificationProps {
  stats: DataUpdateStats | null;
  onClose: () => void;
  autoDismissMs?: number;
}

export const DataUpdateNotification: React.FC<DataUpdateNotificationProps> = ({
  stats,
  onClose,
  autoDismissMs = 8000,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!stats) return;

    setProgress(100);
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPercent = Math.max(0, 100 - (elapsed / autoDismissMs) * 100);
      setProgress(remainingPercent);

      if (elapsed >= autoDismissMs) {
        clearInterval(interval);
        onClose();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [stats, autoDismissMs, onClose]);

  if (!stats) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed top-5 right-5 z-[120] max-w-md w-[calc(100vw-2.5rem)] bg-white dark:bg-slate-900 border border-emerald-500/30 dark:border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-md"
        id="data-update-notification-banner"
      >
        {/* Top Progress bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                    Mise à jour effectuée
                  </h4>
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <Sparkles className="w-2.5 h-2.5" /> Succès
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Base de données synchronisée avec les dernières modifications
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Fermer la notification"
              id="close-update-notif-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {/* Columns Updated Metric */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Colonnes mises à jour</span>
                <Columns className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {stats.updatedColumnsCount}
                </span>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">colonnes</span>
              </div>
            </div>

            {/* Columns Added Metric */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Colonnes ajoutées</span>
                <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {stats.addedColumnsCount}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">nouvellement</span>
              </div>
            </div>
          </div>

          {/* Rows details footer if available */}
          {(stats.updatedRowsCount !== undefined || stats.addedRowsCount !== undefined || stats.totalRows !== undefined) && (
            <div className="mt-3 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-2.5 flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  {stats.updatedRowsCount !== undefined && stats.updatedRowsCount > 0 ? (
                    <><strong>{stats.updatedRowsCount}</strong> lignes modifiées</>
                  ) : null}
                  {stats.updatedRowsCount !== undefined && stats.updatedRowsCount > 0 && stats.addedRowsCount !== undefined && stats.addedRowsCount > 0 ? ' • ' : null}
                  {stats.addedRowsCount !== undefined && stats.addedRowsCount > 0 ? (
                    <><strong>{stats.addedRowsCount}</strong> nouvelles lignes</>
                  ) : null}
                  {(stats.updatedRowsCount === 0 || stats.updatedRowsCount === undefined) && (stats.addedRowsCount === 0 || stats.addedRowsCount === undefined) ? (
                    <>Données réactualisées en base ({stats.totalRows ?? 0} lignes total)</>
                  ) : null}
                </span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
