
import { COLUMNS } from '../constants';
import { GlobalFileRow } from '../types';

/**
 * Dictionnaire des synonymes pour les colonnes critiques
 */
const SYNONYMS: Record<string, string[]> = {
  "ID": ["ID", "IDENTIFIANT", "N°", "REF", "REFERENCE", "SITE ID", "SITE_ID", "CODE SITE", "SITE CODE", "CODE_SITE", "SITE"],
  "Nom du site": ["NOM DU SITE", "SITE", "NAMES SITE", "NAME SITE", "STATION", "NODE", "SITE NAME", "NOM SITE", "NAME_SITE"],
  "Region": ["REGION", "RÉGION", "SECTEUR", "AREA", "ZONE", "DEPARTEMENT", "PROVINCE"],
  "N° SWO": ["N° SWO", "SWO", "NUMERO SWO", "FDWO", "SWO #", "TICKET", "SWO_NUMBER", "NUM_SWO", "N_SWO"],
  "Priorité": ["PRIORITÉ", "PRIORITY", "Prio", "URGENCE", "LEVEL"],
  "State SWO": ["STATE SWO", "STATUS", "STATUT SWO", "ÉTAT SWO", "WORK STATUS", "ETAT SWO", "STATUT"],
  "X": ["X", "STATUT TECHNIQUE", "STATUTS", "TECH STATUS", "ETAPE", "ETAPE TECHNIQUE"],
  "Date de création du SWO": ["DATE DE CRÉATION DU SWO", "DATE CREATION", "CREATED DATE", "DATE OPEN", "DATE CREATION SWO", "DATE_CREATION"],
  "Date de planification": ["DATE DE PLANIFICATION", "DATE PLANIFIÉE", "DATE PLANIFIEE", "PLANNED DATE", "PM PLANNED", "PLAN DATE", "DATE_PLANIF"],
  "PM Date": ["PM DATE", "DATE PM", "PM PLANNED DATE", "PLANNING PM", "DATE PREVUE", "PM_DATE"],
  "PM number": ["PM NUMBER", "N° PM", "PM #", "NUMERO PM", "PM NO", "PM_NO", "PM_NUMBER", "NUM_PM"],
  "Closing date": ["CLOSING DATE", "DATE DE CLÔTURE", "DATE CLOTURE", "DATE EXECUTEE", "PM DATE EXECUTE", "DATE FIN", "DATE_CLOTURE", "EXECUTION DATE"],
  "TAS Status": ["TAS STATUS", "STATUT TAS", "TAS", "STATUS TAS"],
  "Types de PM": ["TYPES DE PM", "TYPE DE PM", "PM TYPE", "MAINTENANCE TYPE", "TYPE MAINTENANCE", "TYPE_PM"],
  "FE names": ["FE NAMES", "FE NAME", "TECHNICIEN", "TECHNICIEN NAME", "INTERVENANT", "AGENT", "NOM DU TECHNICIEN", "FIELD ENGINEER", "FE", "NOM TECHNICIEN"],
  "Description": ["DESCRIPTION", "DETAILS", "OBJET", "SUMMARY", "TASK DESCRIPTION", "INTERVENTION", "LIBELLE", "TASK", "DETAIL"],
  "Comment": ["COMMENT", "COMMENTS", "REMARQUE", "OBSERVATION", "COMMENTAIRE", "NOTES"]
};

/**
 * Normalise un nom d'en-tête (minuscule, sans accent, sans espace superflu)
 */
const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") 
    .replace(/[^a-z0-9]/g, "") 
    .trim();
};

/**
 * Tente de trouver la colonne officielle correspondant à un en-tête brut
 */
const findCanonicalKey = (rawHeader: string): string | null => {
  const normalizedRaw = normalizeString(rawHeader);

  // 1. Vérification directe dans les colonnes officielles
  for (const col of COLUMNS) {
    if (normalizeString(col) === normalizedRaw) return col;
  }

  // 2. Vérification dans le dictionnaire des synonymes
  for (const [canonical, synonyms] of Object.entries(SYNONYMS)) {
    if (synonyms.some(s => normalizeString(s) === normalizedRaw)) {
      return canonical;
    }
  }

  return null;
};

/**
 * Transforme un objet brut (issu d'Excel) en GlobalFileRow avec les clés officielles
 */
export const normalizeRow = (rawRow: Record<string, string | number | Date | null>): GlobalFileRow => {
  const normalizedRow: GlobalFileRow = {};
  
  Object.keys(rawRow).forEach(key => {
    const canonicalKey = findCanonicalKey(key);
    if (canonicalKey) {
      normalizedRow[canonicalKey] = rawRow[key];
    } else {
      // On garde la clé brute si aucun match n'est trouvé, pour ne pas perdre de données
      normalizedRow[key.trim()] = rawRow[key];
    }
  });

  return normalizedRow;
};
