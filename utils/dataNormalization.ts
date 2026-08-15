
import { COLUMNS } from '../constants';
import { GlobalFileRow } from '../types';

/**
 * Dictionnaire des synonymes pour les colonnes critiques
 */
const SYNONYMS: Record<string, string[]> = {
  "ID": ["ID", "IDENTIFIANT", "N°", "REF", "REFERENCE", "SITE ID"],
  "Nom du site": ["NOM DU SITE", "SITE", "NAMES SITE", "NAME SITE", "STATION", "NODE", "SITE NAME"],
  "Region": ["REGION", "RÉGION", "SECTEUR", "AREA", "ZONE", "DEPARTEMENT"],
  "N° SWO": ["N° SWO", "SWO", "NUMERO SWO", "FDWO", "SWO #", "TICKET"],
  "Priorité": ["PRIORITÉ", "PRIORITY", "Prio", "URGENCE"],
  "State SWO": ["STATE SWO", "STATUS", "STATUT SWO", "ÉTAT SWO", "WORK STATUS"],
  "X": ["X", "STATUT TECHNIQUE", "STATUTS", "TECH STATUS", "ETAPE"],
  "Date de création du SWO": ["DATE DE CRÉATION DU SWO", "DATE CREATION", "CREATED DATE", "DATE OPEN"],
  "Date de planification": ["DATE DE PLANIFICATION", "DATE PLANIFIÉE", "DATE PLANIFIEE", "PLANNED DATE", "PM PLANNED", "PLAN DATE"],
  "PM Date": ["PM DATE", "DATE PM", "PM PLANNED DATE", "PLANNING PM"],
  "PM number": ["PM NUMBER", "N° PM", "PM #", "NUMERO PM", "PM NO"],
  "Closing date": ["CLOSING DATE", "DATE DE CLÔTURE", "DATE CLOTURE", "DATE EXECUTEE", "PM DATE EXECUTE", "DATE FIN"],
  "TAS Status": ["TAS STATUS", "STATUT TAS", "TAS"],
  "Types de PM": ["TYPES DE PM", "TYPE DE PM", "PM TYPE", "MAINTENANCE TYPE"],
  "Comment": ["COMMENT", "COMMENTS", "REMARQUE", "OBSERVATION", "COMMENTAIRE"]
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
