
export interface GlobalFileRow {
  [key: string]: string | number | undefined;
  "ID"?: string;
  "Nom du site"?: string;
  "Region"?: string;
  "N° SWO"?: string;
  "Priorité"?: string;
  "Assigned to"?: string;
  "Short description"?: string;
  "Description"?: string;
  "Date de création du SWO"?: string;
  "Date de remontée"?: string;
  "Date de Clôture"?: string;
  "Date de planification"?: string;
  "Intervenant"?: string;
  "N° FIT &/ou DP"?: string;
  "Date de transmission au client"?: string;
  "Date de validation Client"?: string;
  "Comments Reco"?: string;
  "Commentaire"?: string;
  "Closing date"?: string;
  "State SWO"?: string;
  "X"?: string;
  "N°MRO"?: string;
  "Montant (Fcfa)"?: string;
  "PM Date"?: string;
  "Types de PM"?: string;
  "SWAP BATTERIE"?: string;
  "SWAP COURROIE"?: string;
  "SWO A CANCELLE"?: string;
  "CM RETIRES"?: string;
  "PM RETIRES"?: string;
  "TAS Status"?: string;
  "Comment"?: string;
  
  // Nouvelles colonnes de la capture d'écran
  "FDWO"?: string;
  "Names site"?: string; // Synonyme de Nom du site
  "Raison des refuelleurs"?: string;
  "Date executee"?: string;
  "Qte Prevue"?: string;
  "Qte Livres"?: string;
  "Statuts"?: string;
  "CPH"?: string;
  "Application Site"?: string;
  "Grid statut"?: string;
  "PM number"?: string;
  "PM Planned"?: string;
  "PM date execute"?: string;
  "PM date replanifiée"?: string;
  "FE names"?: string;
  "Raison des replanificatio"?: string;
  "status"?: string; // Synonyme de State SWO
  "DG Service 01 Number"?: string;
  "DG Service 01 Executée"?: string;
  "DG Service 01 Status"?: string;
  "DG Service 02 Status"?: string;
  "DG Service 02 Status2"?: string;
  "DG Service 03 Executée"?: string;
  "DG Service 03 Status"?: string;
  "PM aircon Number"?: string;
  "PM aircon Executée"?: string;
  "PM aircon Statut"?: string;
  "PM AIRCON Executée"?: string;
  "PM AIRCON Status"?: string;
}

export enum XStatus {
  CLOSED = "1- CLOSED",
  TVX_STHIC = "2- TVX STHIC",
  STHIC_SPA = "3- STHIC SPA",
  STHIC_ATV_HTC = "4- STHIC ATV HTC",
  HTC = "5- HTC"
}

export enum SWOState {
  CLOSED = "CLOSED",
  OPEN = "OPEN"
}
