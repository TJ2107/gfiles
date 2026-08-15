
import { XStatus, SWOState } from './types';

export const COLUMNS = [
  "ID",
  "Nom du site",
  "Region",
  "N° SWO",
  "Priorité",
  "Assigned to",
  "Short description",
  "Description",
  "Date de création du SWO",
  "Date de planification",
  "Date de Clôture",
  "Date de fermeture des actions",
  "Closing date",
  "Intervenant",
  "N° FIT &/ou DP",
  "Date de transmission au client",
  "Date de validation Client",
  "State SWO",
  "X",
  "PM Date",
  "Types de PM",
  
  // Nouveaux champs issus de la capture
  "FDWO",
  "Raison des refuelleurs",
  "Date executee",
  "Qte Prevue",
  "Qte Livres",
  "Statuts",
  "CPH",
  "Application Site",
  "Grid statut",
  "PM number",
  "PM Planned",
  "PM date execute",
  "PM date replanifiée",
  "FE names",
  "Raison des replanificatio",
  "status",
  "DG Service 01 Number",
  "DG Service 01 Executée",
  "DG Service 01 Status",
  "DG Service 02 Status",
  "DG Service 02 Status2",
  "DG Service 03 Executée",
  "DG Service 03 Status",
  "PM aircon Number",
  "PM aircon Executée",
  "PM aircon Statut",
  "PM AIRCON Executée",
  "PM AIRCON Status",

  "N°MRO",
  "Montant (Fcfa)",
  "SWAP BATTERIE",
  "SWAP COURROIE",
  "SWO A CANCELLE",
  "CM RETIRES",
  "PM RETIRES",
  "TAS Status",
  "Commentaire",
  "Comment"
];

export const X_OPTIONS = Object.values(XStatus);

export const SWO_OPTIONS = [
  SWOState.CLOSED,
  SWOState.OPEN
];

export const REGION_COORDINATES: Record<string, [number, number]> = {
  "BRAZZAVILLE": [-4.263, 15.283],
  "POINTE NOIRE": [-4.778, 11.859],
  "NIARI": [-3.95, 12.2],
  "LEKOUMOU": [-2.9, 13.5],
  "BOUENZA": [-4.15, 13.75],
  "POOL": [-3.5, 14.5],
  "PLATEAUX": [-1.9, 15.6],
  "CUVETTE": [-0.5, 15.9],
  "CUVETTE OUEST": [0.0, 14.5],
  "SANGHA": [1.4, 15.5],
  "LIKOUALA": [2.5, 17.5]
};

export const normalizeXValue = (val: string | number | null | undefined): string => {
  if (val === undefined || val === null) return "";
  return String(val).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
};

export const getXPriorityLevel = (val: string | number | null | undefined): number => {
  const norm = normalizeXValue(val);
  if (!norm) return 0;
  if (norm.startsWith("5")) return 5;
  if (norm.startsWith("4")) return 4;
  if (norm.startsWith("3")) return 3;
  if (norm.startsWith("2")) return 2;
  if (norm.startsWith("1")) return 1;
  if (norm.includes("HTC")) return 5;
  if (norm.includes("ATV") || norm.includes("VALIDATION")) return 4;
  if (norm.includes("SPA")) return 3;
  if (norm.includes("TVX") || norm.includes("TRAVAUX")) return 2;
  if (norm.includes("CLOSED") || norm.includes("CLOTURE")) return 1;
  return 0;
};

export const getRowColorClass = (xValue: string | number | undefined): string => {
  const level = getXPriorityLevel(xValue);
  switch (level) {
    case 5: return "bg-orange-100 hover:bg-orange-200 text-orange-900";
    case 4: return "bg-yellow-100 hover:bg-yellow-200 text-yellow-900";
    case 3: return "bg-blue-100 hover:bg-blue-200 text-blue-900";
    case 2: return "bg-indigo-50/50 hover:bg-indigo-100 text-indigo-900";
    case 1: return "bg-green-100 hover:bg-green-200 text-green-900";
    default: return "bg-white hover:bg-gray-50 text-gray-900";
  }
};
