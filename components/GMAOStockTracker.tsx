import React, { useState, useMemo } from 'react';
import { GlobalFileRow } from '../types';
import { parseDate, formatDate } from '../utils/dateHelpers';
import * as XLSX from 'xlsx';
import { 
  Package, 
  Battery, 
  Layers, 
  Wrench, 
  Zap, 
  Gauge, 
  Search, 
  Calendar, 
  RotateCcw, 
  Filter, 
  ShieldCheck, 
  Flame, 
  Cpu, 
  TrendingUp, 
  BarChart3, 
  PieChart as PieChartIcon, 
  MapPin, 
  User, 
  FileSpreadsheet, 
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

interface GMAOStockTrackerProps {
  data: GlobalFileRow[];
}

export type PartCategory = 
  | 'BATTERY' 
  | 'BELT' 
  | 'DG_FILTER' 
  | 'AIRCON' 
  | 'ELECTRICAL' 
  | 'CALIBRATION_SONDE' 
  | 'HARDWARE' 
  | 'OTHER';

export interface ReplacedPartDetail {
  id: string;
  swo: string;
  pmNumber: string;
  site: string;
  region: string;
  dateStr: string;
  dateObj: Date | null;
  category: PartCategory;
  categoryLabel: string;
  partName: string;
  quantity: number;
  intervenant: string;
  rawSource: string;
  description: string;
}

const CATEGORY_META: Record<PartCategory, { label: string; color: string; bg: string; border: string; icon: React.FC<{ className?: string }> }> = {
  BATTERY: { label: 'Batteries DG/Solaires', color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', icon: Battery },
  BELT: { label: 'Courroies & Poulies', color: '#8b5cf6', bg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800', icon: Layers },
  DG_FILTER: { label: 'DG Services & Filtres', color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', icon: Wrench },
  AIRCON: { label: 'Climatisation & Froid', color: '#0d9488', bg: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800', icon: Zap },
  ELECTRICAL: { label: 'Électrique & Énergie', color: '#ec4899', bg: 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800', icon: Cpu },
  CALIBRATION_SONDE: { label: 'Calibration Sonde', color: '#ef4444', bg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800', icon: Gauge },
  HARDWARE: { label: 'Sécurité & Quincaillerie', color: '#6366f1', bg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800', icon: ShieldCheck },
  OTHER: { label: 'Autres Équipements', color: '#64748b', bg: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700', icon: Package }
};

export const GMAOStockTracker: React.FC<GMAOStockTrackerProps> = ({ data }) => {
  // Period filter state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('ALL');

  // Search & Filters
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeViewTab, setActiveViewTab] = useState<'movements' | 'analytics' | 'top_sites'>('movements');

  // Selected row for detail modal
  const [selectedPartModal, setSelectedPartModal] = useState<ReplacedPartDetail | null>(null);

  // Quick Preset Handlers
  const handleApplyPreset = (preset: string) => {
    setSelectedPreset(preset);
    const now = new Date();

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'TODAY') {
      const todayStr = now.toISOString().slice(0, 10);
      setStartDate(todayStr);
      setEndDate(todayStr);
      return;
    }

    if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
      return;
    }

    if (preset === 'LAST_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
      return;
    }

    if (preset === 'THIS_QUARTER') {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      const firstDay = new Date(now.getFullYear(), quarterMonth, 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), quarterMonth + 3, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
      return;
    }

    if (preset === 'THIS_YEAR') {
      const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
      return;
    }
  };

  // Comprehensive Parts Extractor across the dataset
  const allReplacedParts = useMemo(() => {
    const partsList: ReplacedPartDetail[] = [];

    (data || []).forEach((row, idx) => {
      const site = String(row["Nom du site"] || row["Names site"] || row["ID"] || `Site-${idx}`).trim();
      const region = String(row["Region"] || "INCONNUE").trim();
      const swo = String(row["N° SWO"] || "-").trim();
      const pmNumber = String(row["PM number"] || row["PM Number"] || "-").trim();
      
      const rawDate = row["Date executee"] || 
                      row["Date de création du SWO"] || 
                      row["PM date execute"] || 
                      row["PM Date"] || 
                      row["Date de Clôture"] || 
                      row["Closing date"];
      
      const dateObj = parseDate(rawDate);
      const dateStr = formatDate(rawDate);

      const desc = String(row["Description"] || "").trim();
      const shortDesc = String(row["Short description"] || "").trim();
      const comment = String(row["Commentaire"] || row["Comment"] || row["Comments Reco"] || "").trim();
      const fullText = `${desc} ${shortDesc} ${comment}`.toLowerCase();

      const intervenant = String(row["Intervenant"] || row["FE names"] || row["Assigned to"] || "Équipe Technique").trim();

      // 1. BATTERIES
      const swapBatteryVal = String(row["SWAP BATTERIE"] || "").trim();
      if (swapBatteryVal.length > 0 || fullText.includes('batterie') || fullText.includes('swap bat') || fullText.includes('accumulateur') || fullText.includes('pack bat')) {
        partsList.push({
          id: `bat-${idx}`,
          swo,
          pmNumber,
          site,
          region,
          dateStr,
          dateObj,
          category: 'BATTERY',
          categoryLabel: CATEGORY_META.BATTERY.label,
          partName: swapBatteryVal || 'Remplacement Pack Batteries DG / Solaire',
          quantity: 1,
          intervenant,
          rawSource: swapBatteryVal ? `Champ direct: ${swapBatteryVal}` : 'Détecté dans le rapport',
          description: desc || shortDesc || 'Intervention de remplacement batterie'
        });
      }

      // 2. COURROIES / TRANSMISSION
      const swapBeltVal = String(row["SWAP COURROIE"] || "").trim();
      if (swapBeltVal.length > 0 || fullText.includes('courroie') || fullText.includes('alternateur') || fullText.includes('poulie') || fullText.includes('tendeur')) {
        partsList.push({
          id: `belt-${idx}`,
          swo,
          pmNumber,
          site,
          region,
          dateStr,
          dateObj,
          category: 'BELT',
          categoryLabel: CATEGORY_META.BELT.label,
          partName: swapBeltVal || 'Remplacement Courroie DG / Alternateur',
          quantity: 1,
          intervenant,
          rawSource: swapBeltVal ? `Champ direct: ${swapBeltVal}` : 'Détecté dans le rapport',
          description: desc || shortDesc || 'Intervention de changement courroie'
        });
      }

      // 3. DG SERVICES & FILTRES
      const dg01 = String(row["DG Service 01 Executée"] || row["DG Service 01 Number"] || "").trim();
      const dg03 = String(row["DG Service 03 Executée"] || "").trim();
      if (dg01.length > 0 || dg03.length > 0 || fullText.includes('vidange') || fullText.includes('filtre dg') || fullText.includes('filtre a huile') || fullText.includes('filtre gasoil') || fullText.includes('filtre air') || fullText.includes('huile moteur')) {
        const detailName = dg01 ? `DG Service 01 (${dg01})` : dg03 ? `DG Service 03 (${dg03})` : 'Vidange & Remplacement Filtres DG';
        partsList.push({
          id: `dg-${idx}`,
          swo,
          pmNumber,
          site,
          region,
          dateStr,
          dateObj,
          category: 'DG_FILTER',
          categoryLabel: CATEGORY_META.DG_FILTER.label,
          partName: detailName,
          quantity: 1,
          intervenant,
          rawSource: (dg01 || dg03) ? `Service DG: ${dg01 || dg03}` : 'Détecté dans la description',
          description: desc || shortDesc || 'Maintenance préventive DG / Vidange'
        });
      }

      // 4. CLIMATISATION & FROID
      const pmAircon = String(row["PM aircon Executée"] || row["PM AIRCON Executée"] || row["PM aircon Number"] || "").trim();
      if (pmAircon.length > 0 || fullText.includes('clim') || fullText.includes('aircon') || fullText.includes('compresseur') || fullText.includes('gaz r410') || fullText.includes('freon') || fullText.includes('thermostat')) {
        partsList.push({
          id: `clim-${idx}`,
          swo,
          pmNumber,
          site,
          region,
          dateStr,
          dateObj,
          category: 'AIRCON',
          categoryLabel: CATEGORY_META.AIRCON.label,
          partName: pmAircon ? `PM Aircon (${pmAircon})` : 'Maintenance & Pièces Climatisation (Split / Gaz / Compresseur)',
          quantity: 1,
          intervenant,
          rawSource: pmAircon ? `Aircon direct: ${pmAircon}` : 'Détecté dans la description',
          description: desc || shortDesc || 'Maintenance système de climatisation'
        });
      }

      // 5. CALIBRATION SONDE (Sonde à fuel, calibration sonde, jauges et ravitaillements/fuel)
      const qteLivree = parseFloat(String(row["Qte Livres"] || "0")) || 0;
      const qtePrevue = parseFloat(String(row["Qte Prevue"] || "0")) || 0;
      const fuelQty = qteLivree > 0 ? qteLivree : qtePrevue;
      const isSondeMention = fullText.includes('sonde') || 
                            fullText.includes('calibration') || 
                            fullText.includes('calibrage') || 
                            fullText.includes('étalonnage') || 
                            fullText.includes('etalonnage') || 
                            fullText.includes('jauge') || 
                            fullText.includes('refuel') || 
                            fullText.includes('ravitaillement') || 
                            fullText.includes('carburant') || 
                            fullText.includes('livraison gasoil') ||
                            fuelQty > 0;

      if (isSondeMention) {
        let partDesignation = "Sonde à fuel";
        if (fullText.includes('calibration') || fullText.includes('calibrage') || fullText.includes('étalonnage') || fullText.includes('etalonnage')) {
          partDesignation = "Sonde à fuel";
        } else if (fuelQty > 0) {
          partDesignation = "Sonde à fuel";
        }

        partsList.push({
          id: `sonde-${idx}`,
          swo,
          pmNumber,
          site,
          region,
          dateStr,
          dateObj,
          category: 'CALIBRATION_SONDE',
          categoryLabel: CATEGORY_META.CALIBRATION_SONDE.label,
          partName: partDesignation,
          quantity: 1,
          intervenant,
          rawSource: fuelQty > 0 ? `Sonde / Fuel: ${fuelQty}L` : 'Calibration Sonde à fuel',
          description: desc || shortDesc || 'Intervention Sonde à fuel & Calibration de réservoir'
        });
      }

      // 6. ÉLECTRIQUE & ÉNERGIE
      if (fullText.includes('disjoncteur') || fullText.includes('parafoudre') || fullText.includes('contacteur') || fullText.includes('avr') || fullText.includes('transformateur') || fullText.includes('chargeur') || fullText.includes('redresseur') || fullText.includes('relais')) {
        let electricPart = 'Remplacement Composant Électrique';
        if (fullText.includes('disjoncteur')) electricPart = 'Disjoncteur / Breaker';
        else if (fullText.includes('parafoudre')) electricPart = 'Parafoudre / Surge Arrester';
        else if (fullText.includes('contacteur')) electricPart = 'Contacteur Inverseur';
        else if (fullText.includes('avr')) electricPart = 'Régulateur AVR';
        else if (fullText.includes('chargeur')) electricPart = 'Module Chargeur / Redresseur';

        partsList.push({
          id: `elec-${idx}`,
          swo,
          pmNumber,
          site,
          region,
          dateStr,
          dateObj,
          category: 'ELECTRICAL',
          categoryLabel: CATEGORY_META.ELECTRICAL.label,
          partName: electricPart,
          quantity: 1,
          intervenant,
          rawSource: 'Analyse textuelle',
          description: desc || shortDesc || 'Remplacement équipement électrique'
        });
      }

      // 7. QUINCAILLERIE & SÉCURITÉ
      if (fullText.includes('cadenas') || fullText.includes('serrure') || fullText.includes('câble') || fullText.includes('cable') || fullText.includes('cosse') || fullText.includes('grillage') || fullText.includes('extincteur')) {
        let hwPart = 'Quincaillerie & Sécurité Site';
        if (fullText.includes('cadenas') || fullText.includes('serrure')) hwPart = 'Serrure / Cadenas de baie';
        else if (fullText.includes('cable') || fullText.includes('câble') || fullText.includes('cosse')) hwPart = 'Câblage DC/AC & Cosses';
        else if (fullText.includes('extincteur')) hwPart = 'Remplacement Extincteur';

        partsList.push({
          id: `hw-${idx}`,
          swo,
          pmNumber,
          site,
          region,
          dateStr,
          dateObj,
          category: 'HARDWARE',
          categoryLabel: CATEGORY_META.HARDWARE.label,
          partName: hwPart,
          quantity: 1,
          intervenant,
          rawSource: 'Analyse textuelle',
          description: desc || shortDesc || 'Sécurité / Accessoires de site'
        });
      }
    });

    return partsList;
  }, [data]);

  // Filter Parts by Period (Date Range)
  const periodFilteredParts = useMemo(() => {
    if (!startDate && !endDate) return allReplacedParts;

    const startObj = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const endObj = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return allReplacedParts.filter(part => {
      if (!part.dateObj) return true; // Keep if undated to avoid losing entries
      if (startObj && part.dateObj < startObj) return false;
      if (endObj && part.dateObj > endObj) return false;
      return true;
    });
  }, [allReplacedParts, startDate, endDate]);

  // Secondary Filters (Region, Category, Search Query)
  const filteredParts = useMemo(() => {
    return periodFilteredParts.filter(part => {
      const matchRegion = selectedRegion === 'ALL' || part.region.toUpperCase() === selectedRegion.toUpperCase();
      const matchCategory = selectedCategory === 'ALL' || part.category === selectedCategory;
      const matchSearch = searchTerm === '' || 
        part.site.toLowerCase().includes(searchTerm.toLowerCase()) || 
        part.swo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.pmNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.partName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.intervenant.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.description.toLowerCase().includes(searchTerm.toLowerCase());

      return matchRegion && matchCategory && matchSearch;
    });
  }, [periodFilteredParts, selectedRegion, selectedCategory, searchTerm]);

  // Metrics Summary
  const metrics = useMemo(() => {
    const total = filteredParts.length;
    const batteries = filteredParts.filter(p => p.category === 'BATTERY').length;
    const belts = filteredParts.filter(p => p.category === 'BELT').length;
    const dgFilters = filteredParts.filter(p => p.category === 'DG_FILTER').length;
    const aircon = filteredParts.filter(p => p.category === 'AIRCON').length;
    const electrical = filteredParts.filter(p => p.category === 'ELECTRICAL').length;
    const hardware = filteredParts.filter(p => p.category === 'HARDWARE').length;
    const calibrationSonde = filteredParts.filter(p => p.category === 'CALIBRATION_SONDE').length;

    return {
      total,
      batteries,
      belts,
      dgFilters,
      aircon,
      electrical,
      hardware,
      calibrationSonde
    };
  }, [filteredParts]);

  // Regional Breakdown Data for BarChart
  const regionalChartData = useMemo(() => {
    const regMap: Record<string, { region: string; batteries: number; belts: number; dgFilters: number; aircon: number; electrical: number; hardware: number; calibrationSonde: number; total: number }> = {};

    filteredParts.forEach(p => {
      const reg = p.region.toUpperCase() || 'AUTRE';
      if (!regMap[reg]) {
        regMap[reg] = { region: reg, batteries: 0, belts: 0, dgFilters: 0, aircon: 0, electrical: 0, hardware: 0, calibrationSonde: 0, total: 0 };
      }
      regMap[reg].total++;
      if (p.category === 'BATTERY') regMap[reg].batteries++;
      else if (p.category === 'BELT') regMap[reg].belts++;
      else if (p.category === 'DG_FILTER') regMap[reg].dgFilters++;
      else if (p.category === 'AIRCON') regMap[reg].aircon++;
      else if (p.category === 'ELECTRICAL') regMap[reg].electrical++;
      else if (p.category === 'HARDWARE') regMap[reg].hardware++;
      else if (p.category === 'CALIBRATION_SONDE') regMap[reg].calibrationSonde++;
    });

    return Object.values(regMap).sort((a, b) => b.total - a.total);
  }, [filteredParts]);

  // Category Breakdown Data for PieChart
  const categoryPieData = useMemo(() => {
    const catMap: Record<string, number> = {};
    filteredParts.forEach(p => {
      catMap[p.category] = (catMap[p.category] || 0) + 1;
    });

    return Object.entries(catMap).map(([cat, count]) => {
      const meta = CATEGORY_META[cat as PartCategory] || CATEGORY_META.OTHER;
      return {
        category: cat,
        name: meta.label,
        value: count,
        color: meta.color
      };
    }).sort((a, b) => b.value - a.value);
  }, [filteredParts]);

  // Top Sites Consuming Replaced Parts
  const topSitesData = useMemo(() => {
    const siteMap: Record<string, { site: string; region: string; totalParts: number; categories: Set<string> }> = {};

    filteredParts.forEach(p => {
      if (!siteMap[p.site]) {
        siteMap[p.site] = { site: p.site, region: p.region, totalParts: 0, categories: new Set() };
      }
      siteMap[p.site].totalParts++;
      siteMap[p.site].categories.add(p.categoryLabel);
    });

    return Object.values(siteMap)
      .map(s => ({ ...s, categoriesList: Array.from(s.categories).join(', ') }))
      .sort((a, b) => b.totalParts - a.totalParts)
      .slice(0, 15);
  }, [filteredParts]);

  // Available Regions list for dropdown
  const uniqueRegions = useMemo(() => {
    const set = new Set<string>();
    allReplacedParts.forEach(p => {
      if (p.region) set.add(p.region.toUpperCase());
    });
    return Array.from(set).sort();
  }, [allReplacedParts]);

  // Excel Export Handler
  const handleExportExcel = () => {
    const exportRows = filteredParts.map(p => ({
      "N° SWO": p.swo,
      "N° PM": p.pmNumber,
      "Nom du Site": p.site,
      "Région": p.region,
      "Date": p.dateStr,
      "Catégorie GMAO": p.categoryLabel,
      "Désignation Pièce & Équipement": p.partName,
      "Quantité Estimée": p.quantity,
      "Intervenant": p.intervenant,
      "Source Détection": p.rawSource,
      "Détails Intervention": p.description
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GMAO_Pieces_Remplacees");
    
    const periodLabel = startDate && endDate ? `${startDate}_au_${endDate}` : 'Complet';
    XLSX.writeFile(wb, `GMAO_Analyse_Pieces_${periodLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      
      {/* 1. HEADER & PERIOD SELECTOR BANNER */}
      <div className="p-4 sm:p-6 lg:p-8 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white shadow-xl border border-slate-800 space-y-6">
        
        {/* Top Header Row */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-indigo-500/20 backdrop-blur border border-indigo-400/30 rounded-2xl shrink-0 shadow-inner">
              <Package className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
                  Suivi du Stock & Analyse des Pièces (GMAO)
                </h2>
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase rounded-full border border-indigo-400/30">
                  Maintenance Réseau
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
                Traçabilité exhaustive de toutes les pièces, calibrage sondes et consommables remplacés par site, région et intervenant.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <button
              onClick={handleExportExcel}
              className="w-full lg:w-auto px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-95 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exporter Rapport Excel ({filteredParts.length} pièces)</span>
            </button>
          </div>
        </div>

        {/* PERIOD SELECTOR ROW (RESPONSIVE) */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
          
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 xl:pb-0 custom-scrollbar">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mr-2 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Période :
            </span>
            {[
              { id: 'ALL', label: 'Tout' },
              { id: 'TODAY', label: "Aujourd'hui" },
              { id: 'THIS_MONTH', label: 'Ce Mois' },
              { id: 'LAST_MONTH', label: 'Mois Dernier' },
              { id: 'THIS_QUARTER', label: 'Ce Trimestre' },
              { id: 'THIS_YEAR', label: 'Année' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedPreset === p.id 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Range Inputs */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Du :</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setSelectedPreset('CUSTOM'); }}
                className="bg-transparent text-xs font-bold text-slate-100 border-none outline-none focus:ring-0 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Au :</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setSelectedPreset('CUSTOM'); }}
                className="bg-transparent text-xs font-bold text-slate-100 border-none outline-none focus:ring-0 cursor-pointer"
              />
            </div>

            {(startDate || endDate) && (
              <button
                onClick={() => handleApplyPreset('ALL')}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                title="Réinitialiser la période"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>

      </div>

      {/* 2. BENTO METRICS OVERVIEW (ADAPTIVE RESPONSIVE GRID) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
        
        {/* Total Parts */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
              Total Remplacées
            </span>
            <Package className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100">{metrics.total}</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Pièces identifiées</span>
          </div>
        </div>

        {/* Batteries */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">
              Batteries
            </span>
            <Battery className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100">{metrics.batteries}</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Swaps batterie</span>
          </div>
        </div>

        {/* Courroies */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase text-purple-600 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-md">
              Courroies
            </span>
            <Layers className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100">{metrics.belts}</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">DG / Alternateur</span>
          </div>
        </div>

        {/* DG & Filtres */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
              DG & Vidanges
            </span>
            <Wrench className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100">{metrics.dgFilters}</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Services exécutés</span>
          </div>
        </div>

        {/* Climatisation */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase text-teal-600 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md">
              Climatisation
            </span>
            <Zap className="w-4 h-4 text-teal-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100">{metrics.aircon}</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Splits & Gaz</span>
          </div>
        </div>

        {/* Électrique */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase text-pink-600 bg-pink-50 dark:bg-pink-950/60 px-2 py-0.5 rounded-md">
              Électrique
            </span>
            <Cpu className="w-4 h-4 text-pink-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100">{metrics.electrical}</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Disjoncteurs/AVR</span>
          </div>
        </div>

        {/* Calibration Sonde */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md">
              Calibration Sonde
            </span>
            <Gauge className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100">
              {metrics.calibrationSonde}
            </span>
            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Sondes à fuel</span>
          </div>
        </div>

      </div>

      {/* 3. NAVIGATION VIEW TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl">
          <button
            onClick={() => setActiveViewTab('movements')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeViewTab === 'movements'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Journal des Pièces Remplacées ({filteredParts.length})</span>
          </button>

          <button
            onClick={() => setActiveViewTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeViewTab === 'analytics'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analyses & Graphiques Régionaux</span>
          </button>

          <button
            onClick={() => setActiveViewTab('top_sites')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeViewTab === 'top_sites'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Top Sites Consommateurs</span>
          </button>
        </div>

        <span className="text-xs text-slate-400 font-bold">
          {startDate || endDate ? `Période filtrée : ${startDate || 'Origine'} ➔ ${endDate || 'Actuel'}` : 'Période : Tout l\'historique'}
        </span>
      </div>

      {/* 4. TAB 1: MOVEMENTS TABLE & SEARCH */}
      {activeViewTab === 'movements' && (
        <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          
          {/* SEARCH & FILTERS BAR */}
          <div className="flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center pb-3 border-b border-slate-100 dark:border-slate-800">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par nom de site, N° SWO, intervenant, pièce..."
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Region Dropdown */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 border-none outline-none focus:ring-0 cursor-pointer"
                >
                  <option value="ALL">Toutes les Régions ({uniqueRegions.length})</option>
                  {uniqueRegions.map(reg => (
                    <option key={reg} value={reg}>{reg}</option>
                  ))}
                </select>
              </div>

              {/* Reset search */}
              {(searchTerm || selectedRegion !== 'ALL' || selectedCategory !== 'ALL') && (
                <button
                  onClick={() => { setSearchTerm(''); setSelectedRegion('ALL'); setSelectedCategory('ALL'); }}
                  className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-300 rounded-xl transition-all"
                  title="Réinitialiser filtres"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>

          </div>

          {/* CATEGORY CHIPS SELECTOR */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Catégorie :
            </span>
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-indigo-600 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Toutes ({periodFilteredParts.length})
            </button>
            {Object.entries(CATEGORY_META).map(([cat, meta]) => {
              const count = periodFilteredParts.filter(p => p.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCategory === cat
                      ? `${meta.bg} ${meta.border} border shadow-xs ring-2 ring-indigo-500/20`
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <meta.icon className="w-3 h-3" />
                  <span>{meta.label} ({count})</span>
                </button>
              );
            })}
          </div>

          {/* TABLE OF REPLACED PARTS */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase font-black text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">N° SWO / PM</th>
                  <th className="p-3.5">Nom du Site</th>
                  <th className="p-3.5">Région</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Catégorie</th>
                  <th className="p-3.5">Désignation Pièce & Équipement</th>
                  <th className="p-3.5">Intervenant</th>
                  <th className="p-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredParts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-bold text-sm">Aucune pièce remplacée trouvée pour cette sélection.</p>
                      <p className="text-xs text-slate-400 mt-1">Essayez d'élargir la période ou d'ajuster les filtres.</p>
                    </td>
                  </tr>
                ) : (
                  filteredParts.slice(0, 100).map((part) => {
                    const meta = CATEGORY_META[part.category] || CATEGORY_META.OTHER;
                    return (
                      <tr key={part.id} className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {part.swo !== '-' ? part.swo : part.pmNumber}
                        </td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">
                          {part.site}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold uppercase text-[10px] text-slate-700 dark:text-slate-300">
                            {part.region}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 whitespace-nowrap">
                          {part.dateStr}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border flex items-center gap-1 w-fit ${meta.bg} ${meta.border}`}>
                            <meta.icon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">
                          {part.partName}
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {part.intervenant}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => setSelectedPartModal(part)}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                          >
                            Détails
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredParts.length > 100 && (
            <p className="text-[11px] text-slate-400 text-center font-medium pt-2">
              Affichage des 100 premières pièces sur {filteredParts.length}. Exportez en Excel pour obtenir l'intégralité.
            </p>
          )}

        </div>
      )}

      {/* 5. TAB 2: ANALYTICS & REGIONAL CHARTS */}
      {activeViewTab === 'analytics' && (
        <div className="space-y-6">
          
          {/* Regional Multi-Bar Chart */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <h3 className="font-black text-slate-900 dark:text-slate-100 uppercase text-xs tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  Consommation de Pièces par Région
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Répartition détaillée des matériels remplacés par zone géographique</p>
              </div>
            </div>

            <div className="h-80 w-full min-h-[300px] min-w-0 pt-4">
              <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={250} debounce={50}>
                <BarChart data={regionalChartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="region" tick={{ fontSize: 10, fontWeight: 700 }} angle={-25} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '10px' }} />
                  <Bar dataKey="batteries" name="Batteries" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="belts" name="Courroies" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="dgFilters" name="DG & Vidanges" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="aircon" name="Climatisation" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="electrical" name="Électrique" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="calibrationSonde" name="Calibration Sonde" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Pie & Top Consumption Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Donut Chart: Categories Distribution */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="font-black text-slate-900 dark:text-slate-100 uppercase text-xs tracking-wider flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-indigo-500" />
                  Répartition Globale par Catégorie de Pièce
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Pourcentage de remplacement sur la période sélectionnée</p>
              </div>

              <div className="h-72 w-full min-h-[250px] min-w-0 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={200} debounce={50}>
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={4}
                    >
                      {categoryPieData.map((entry, index) => (
                        <Cell key={`pie-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} 
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Summary Breakdown List */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="font-black text-slate-900 dark:text-slate-100 uppercase text-xs tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  Synthèse Statistique GMAO
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Volumes et poids relatifs de chaque type d'équipement</p>
              </div>

              <div className="space-y-3 pt-2">
                {categoryPieData.map((cat) => {
                  const percent = metrics.total > 0 ? Math.round((cat.value / metrics.total) * 100) : 0;
                  return (
                    <div key={cat.category} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: cat.color }}></div>
                        <div>
                          <p className="text-xs font-black text-slate-800 dark:text-slate-100">{cat.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{cat.value} interventions ({percent}%)</p>
                        </div>
                      </div>
                      <div className="w-24 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: cat.color }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 6. TAB 3: TOP SITES CONSUMING PARTS */}
      {activeViewTab === 'top_sites' && (
        <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-black text-slate-900 dark:text-slate-100 uppercase text-xs tracking-wider flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Top Sites à Forte Consommation de Pièces
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">Sites télécoms ayant nécessité le plus de remplacements matériels</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topSitesData.map((siteItem, idx) => (
              <div key={siteItem.site} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="font-black text-xs text-slate-900 dark:text-slate-100">{siteItem.site}</h4>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{siteItem.region}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs">
                    {siteItem.totalParts} pièces
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Catégories impliquées :</span>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{siteItem.categoriesList}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. MODAL: DETAILED PART RECORD */}
      {selectedPartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
                  <Package className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight">Fiche Remplacement Pièce</h3>
                  <p className="text-[10px] text-slate-300">SWO: {selectedPartModal.swo} | PM: {selectedPartModal.pmNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPartModal(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Site Télécom</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedPartModal.site}</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Région</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{selectedPartModal.region}</span>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/60 dark:bg-rose-950/40 rounded-2xl border border-rose-100 dark:border-rose-800/60">
                <span className="text-[9px] font-black uppercase text-rose-600 dark:text-rose-400 block mb-1">Désignation Pièce</span>
                <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{selectedPartModal.partName}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">Catégorie: {selectedPartModal.categoryLabel}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-slate-400" /> Date
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedPartModal.dateStr}</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1 mb-1">
                    <User className="w-3 h-3 text-slate-400" /> Intervenant
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedPartModal.intervenant}</span>
                </div>
              </div>

              {selectedPartModal.description && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Description / Commentaire</span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{selectedPartModal.description}</p>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedPartModal(null)}
                className="px-5 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer"
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
