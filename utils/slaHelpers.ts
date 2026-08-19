import { GlobalFileRow } from '../types';
import { parseDate } from './dateHelpers';

export interface SLAStatus {
  level: 'critical' | 'warning' | 'normal' | 'closed' | 'pm_delay';
  badgeText: string;
  badgeClass: string;
  hoursOpen: number;
  isOpen: boolean;
  isDelay: boolean;
}

export function calculateSLABadge(row: GlobalFileRow): SLAStatus {
  const stateVal = (row["State SWO"] || row["Statut"] || row["status"] || "").toString().toLowerCase();
  const isClosed = stateVal.includes("clôtur") || stateVal.includes("clotur") || stateVal.includes("closed") || stateVal.includes("fermé") || stateVal.includes("resolved") || stateVal.includes("exécuté") || stateVal.includes("execute");

  if (isClosed) {
    return {
      level: 'closed',
      badgeText: 'CLÔTURÉ',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      hoursOpen: 0,
      isOpen: false,
      isDelay: false,
    };
  }

  // Calculate age based on creation date
  const creationRaw = row["Date de création du SWO"] || row["PM Date"] || row["Date de planification"];
  const creationDate = parseDate(creationRaw);
  
  let hoursOpen = 0;
  if (creationDate) {
    const diffMs = Date.now() - creationDate.getTime();
    hoursOpen = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  }

  // Check if PM is delayed or rescheduled
  const pmReplanned = !!(row["PM date replanifiée"] || row["PM date replanification"] || row["Raison des replanificatio"]);
  const statusLower = (row["status"] || row["Statuts"] || "").toString().toLowerCase();
  const isPMDelay = statusLower.includes("retard") || pmReplanned;

  if (hoursOpen >= 72) {
    return {
      level: 'critical',
      badgeText: `CRITIQUE (${hoursOpen}H)`,
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 animate-pulse font-black',
      hoursOpen,
      isOpen: true,
      isDelay: isPMDelay,
    };
  }

  if (hoursOpen >= 48) {
    return {
      level: 'warning',
      badgeText: `URGENT (${hoursOpen}H)`,
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-bold',
      hoursOpen,
      isOpen: true,
      isDelay: isPMDelay,
    };
  }

  if (isPMDelay) {
    return {
      level: 'pm_delay',
      badgeText: 'REPLANIFIÉ / EN RETARD',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 font-semibold',
      hoursOpen,
      isOpen: true,
      isDelay: true,
    };
  }

  return {
    level: 'normal',
    badgeText: `DANS SLA (${hoursOpen}H)`,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-medium',
    hoursOpen,
    isOpen: true,
    isDelay: false,
  };
}
