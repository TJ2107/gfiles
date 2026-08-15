
import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { GlobalFileRow } from './types';
import { FileUpload } from './components/FileUpload';
import { DataTable } from './components/DataTable';
import { Dashboard } from './components/Dashboard';
import { DailyStatus } from './components/DailyStatus';
import { TTFAnalysis } from './components/TTFAnalysis';
import { GMSheet } from './components/GMSheet';
import { TASAnalysis } from './components/TASAnalysis';
import { BatteryTracker } from './components/BatteryTracker';
import { BeltTracker } from './components/BeltTracker';
import { ExportManager } from './components/ExportManager';
import { FEModule } from './components/FEModule';
import { ActivityReport } from './components/ActivityReport';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SettingsPanel } from './components/SettingsPanel';
import { MigrationAssistant } from './components/MigrationAssistant';
import { MobilePortal } from './components/MobilePortal';
import { DataUpdateNotification, DataUpdateStats } from './components/DataUpdateNotification';
import { CommandPalette } from './components/CommandPalette';
import { ExecutiveBriefModal } from './components/ExecutiveBriefModal';
import { computeDataDiffStats } from './utils/dataDiff';
import { 
  Layout, Database, PieChart, Calendar, Timer, 
  Briefcase, Battery, Settings2, Loader2, 
  Download, Settings, Menu, X, ChevronRight, ClipboardList,
  PanelLeftClose, PanelLeftOpen,
  Bell, ArrowRight, ShieldAlert, LogOut, Users, BarChart3,
  ArrowLeft, CheckCircle2, Wrench, Sparkles, Command, FileCheck
} from 'lucide-react';

import { parseDate } from './utils/dateHelpers';

import { useAuth } from './components/AuthProvider';
import { LoginView } from './components/LoginView';
import { logout, updatePresence } from './firebase';
import { saveToFirebase, fetchFromFirebase, getActiveDataSource, DataSourceType } from './firebaseData';

const App: React.FC = () => {
  const { user, role } = useAuth();

  const [data, setData] = useState<GlobalFileRow[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [currentSource, setCurrentSource] = useState<DataSourceType>(() => getActiveDataSource());
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme_mode') as 'light' | 'dark' | 'system') || 'system';
    }
    return 'system';
  });
  const [isNightMode, setIsNightMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dbQuotaError, setDbQuotaError] = useState<boolean>(false);
  const [isConfirmingHeaderLogout, setIsConfirmingHeaderLogout] = useState(false);
  const [isConfirmingSidebarLogout, setIsConfirmingSidebarLogout] = useState(false);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [updateNotificationStats, setUpdateNotificationStats] = useState<DataUpdateStats | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isExecutiveBriefOpen, setIsExecutiveBriefOpen] = useState(false);

  const isAdmin = role === 'Admin';
  const isManager = role === 'Manager' || role === 'Admin';

  // Listen to open-command-palette event
  useEffect(() => {
    const handleOpenPalette = () => setIsCommandPaletteOpen(true);
    window.addEventListener('open-command-palette', handleOpenPalette);
    return () => window.removeEventListener('open-command-palette', handleOpenPalette);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileOrTablet(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen to Firestore quota exceeded events globally to notify users immediately
  useEffect(() => {
    const handleQuotaExceeded = () => {
      setDbQuotaError(true);
    };
    window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Listen to active data source changes (Firebase vs Cloudflare D1)
  useEffect(() => {
    const handleSourceChange = (e: Event) => {
      const customEvent = e as CustomEvent<DataSourceType>;
      if (customEvent.detail) {
        setCurrentSource(customEvent.detail);
      } else {
        setCurrentSource(getActiveDataSource());
      }
    };
    window.addEventListener('data-source-changed', handleSourceChange);
    return () => window.removeEventListener('data-source-changed', handleSourceChange);
  }, []);

  // Listen to custom data update notification events
  useEffect(() => {
    const handleShowUpdateNotification = (e: Event) => {
      const customEvent = e as CustomEvent<DataUpdateStats>;
      if (customEvent.detail) {
        setUpdateNotificationStats(customEvent.detail);
      }
    };
    window.addEventListener('show-data-update-notification', handleShowUpdateNotification);
    return () => window.removeEventListener('show-data-update-notification', handleShowUpdateNotification);
  }, []);

  // Real-time user presence tracking
  useEffect(() => {
    if (!user) return;
    updatePresence(user, activeTab);
    const interval = setInterval(() => {
      updatePresence(user, activeTab);
    }, 30000);
    return () => clearInterval(interval);
  }, [user, activeTab]);

  // Effect to handle late-arriving admin status and empty data
  useEffect(() => {
    if (!isLoading && data.length === 0) {
      setActiveTab(isManager ? 'upload' : (isMobileOrTablet ? 'portal' : 'dashboard'));
    }
  }, [isManager, isLoading, data.length, isMobileOrTablet]);

  // Reset portal tab to dashboard on PC/Desktop format
  useEffect(() => {
    if (!isMobileOrTablet && activeTab === 'portal') {
      setActiveTab('dashboard');
    }
  }, [isMobileOrTablet, activeTab]);

  // State for alert thresholds
  const [batteryThreshold, setBatteryThreshold] = useState<number>(7);
  const [beltThreshold, setBeltThreshold] = useState<number>(180);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [needsMigration, setNeedsMigration] = useState(false);

  // States for Version Announcement & Maintenance Mode
  const [maintenanceActive, setMaintenanceActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('maintenance_active') === 'true';
    }
    return false;
  });

  const [versionAnnounceActive, setVersionAnnounceActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('version_announce_dismissed') !== 'v3.5.0';
    }
    return true;
  });

  const [showChangelogModal, setShowChangelogModal] = useState<boolean>(false);

  useEffect(() => {
    const applyTheme = () => {
      const isDark = 
        themeMode === 'dark' || 
        (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      setIsNightMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    if (themeMode === 'system' && typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [themeMode]);
  const globalAlerts = useMemo(() => {
    const alerts: { id: string; type: 'CRITICAL' | 'WARNING'; category: string; title: string; desc: string; swo?: string }[] = [];
    const now = new Date();

    if (!data || !Array.isArray(data) || data.length === 0) return alerts;

    const batterySites: Record<string, { date: Date, swo: string }> = {};
    const beltSites: Record<string, { date: Date, swo: string }> = {};

    data.forEach(row => {
      if (!row) return;
      const desc = String(row["Description"] || "").toLowerCase();
      const site = String(row["Nom du site"] || "Unknown").trim().toUpperCase();
      const date = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
      const swo = String(row["N° SWO"]);
      const swoState = String(row["State SWO"] || "").toLowerCase();
      
      if (!date) return;

      // Strict search for battery replacements based on user request
      const batteryKeywords = [
        "swap battery ge", 
        "remplacement batterie ge", 
        "remplacement battery ge"
      ];
      const isBatteryTask = batteryKeywords.some(k => desc.includes(k));

      if (isBatteryTask && swoState === 'closed') {
        if (!batterySites[site] || date > batterySites[site].date) {
          batterySites[site] = { date, swo };
        }
      }
      
      if (desc.includes("courroie")) {
        if (!beltSites[site] || date > beltSites[site].date) beltSites[site] = { date, swo };
      }
    });

    // Alertes Batteries
    Object.entries(batterySites).forEach(([site, info]) => {
      const months = (now.getFullYear() - info.date.getFullYear()) * 12 + (now.getMonth() - info.date.getMonth());
      if (months >= batteryThreshold) {
        alerts.push({ id: `bat-${site}`, type: 'CRITICAL', category: 'Batterie', title: site, desc: `Expirée (${months} mois)`, swo: info.swo });
      }
    });

    // Alertes Courroies
    Object.entries(beltSites).forEach(([site, info]) => {
      const diffDays = Math.floor((now.getTime() - info.date.getTime()) / (1000 * 3600 * 24));
      if (diffDays >= beltThreshold) {
        alerts.push({ id: `belt-${site}`, type: 'CRITICAL', category: 'Courroie', title: site, desc: `Seuil 1000h dépassé (${diffDays}j)`, swo: info.swo });
      }
    });

    return alerts;
  }, [data, batteryThreshold, beltThreshold]);

  const filteredData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    return data.filter(row => {
      if (!row) return false;
      return Object.entries(filters).every(([key, filterValue]) => {
        const val = filterValue as string;
        if (!val) return true;
        if (val.startsWith('DATE_RANGE|')) return true; 

        const cellValue = row[key];
        const cellString = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';
        return cellString.toLowerCase().includes(val.toLowerCase());
      });
    });
  }, [data, filters]);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      try {
        const dbData = await fetchFromFirebase();
        const isMobile = window.innerWidth < 1024;
        if (Array.isArray(dbData) && dbData.length > 0) {
          // Sort data by most recent date by default (Closing date or Date de Clôture)
          const sortedData = [...dbData].sort((a, b) => {
            const dateA = parseDate(a["Closing date"]) || parseDate(a["Date de Clôture"]) || new Date(0);
            const dateB = parseDate(b["Closing date"]) || parseDate(b["Date de Clôture"]) || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });
          setData(sortedData);
          setActiveTab(isMobile ? 'portal' : 'dashboard');
        } else {
          setActiveTab(isAdmin ? 'upload' : (isMobile ? 'portal' : 'dashboard'));
        }
      } catch (error) {
        console.error('Error fetching data from Firebase:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota exceeded') || errMsg.includes('quota')) {
          setDbQuotaError(true);
        }
        const isMobile = window.innerWidth < 1024;
        setActiveTab(isAdmin ? 'upload' : (isMobile ? 'portal' : 'dashboard'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, isAdmin]);



  useEffect(() => {
    const savedSettings = localStorage.getItem('globalFiles_settings');
    if (savedSettings) {
      try {
        const { batteryThreshold, beltThreshold } = JSON.parse(savedSettings);
        if (typeof batteryThreshold === 'number') setBatteryThreshold(batteryThreshold);
        if (typeof beltThreshold === 'number') setBeltThreshold(beltThreshold);
      } catch (e) { 
        console.error("Failed to parse settings from localStorage", e); 
      }
    }
  }, []);

  const handleDataLoaded = async (newData: GlobalFileRow[], append: boolean) => {
    setIsLoading(true);
    setDbQuotaError(false);
    try {
      const stats = computeDataDiffStats(data, newData, append);
      console.log(`Starting Firebase save process. Total rows: ${newData.length}, Append: ${append}`);
      await saveToFirebase(newData, append);
      
      console.log('Firebase chunks saved. Re-fetching data...');
      
      const dbData = await fetchFromFirebase();
      console.log(`Data re-fetched from Firebase. Total rows: ${dbData.length}`);
      
      setData(dbData);
      setUpdateNotificationStats(stats);
    } catch (error) {
      console.error('CRITICAL: Error saving data:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota exceeded') || errMsg.includes('quota')) {
        setDbQuotaError(true);
      } else {
        alert('Erreur lors de la sauvegarde des données: ' + errMsg);
      }
    } finally {
      setIsLoading(false);
    }
    setActiveTab('dashboard');
    setIsSidebarOpen(false);
  };

  const handleSaveFullDatabase = async () => {
    if (!window.confirm("Voulez-vous vraiment sauvegarder les modifications dans Row Data ?")) return;
    setIsLoading(true);
    setDbQuotaError(false);
    try {
      const stats = computeDataDiffStats(data, data, false);
      await saveToFirebase(data, false);
      setUpdateNotificationStats(stats);
    } catch (error) {
      console.error('Error updating database:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota exceeded') || errMsg.includes('quota')) {
        setDbQuotaError(true);
      } else {
        alert('Erreur lors de la mise à jour: ' + errMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAlertClick = (swo?: string) => {
    if (swo) {
      setFilters({ "N° SWO": swo });
      setActiveTab('data');
    }
    setIsNotifOpen(false);
  };

  const handleSaveSettings = (newBattery: number, newBelt: number) => {
    setBatteryThreshold(newBattery);
    setBeltThreshold(newBelt);
    localStorage.setItem('globalFiles_settings', JSON.stringify({ batteryThreshold: newBattery, beltThreshold: newBelt }));
    setActiveTab('dashboard');
  };

  const NavButton = ({ id, label, icon: Icon, colorClass, isNew }: { id: string, label: string, icon: React.ElementType, colorClass?: string, isNew?: boolean }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }}
        className={`w-full group flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} px-3.5 py-3 rounded-xl text-xs font-medium tracking-wide transition-all duration-300 relative ${
          isActive 
            ? (colorClass || 'bg-slate-900 text-indigo-400 border border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.15)] translate-x-1') 
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
        }`}
      >
        <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="relative flex items-center justify-center">
            <Icon className={`w-[18px] h-[18px] transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
            {isNew && !isActive && <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping"></span>}
          </div>
          {!isSidebarCollapsed && <span className="truncate">{label}</span>}
        </div>
        {!isSidebarCollapsed && isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />}
        {!isSidebarCollapsed && isActive && <span className="absolute left-0 top-3 bottom-3 w-[3px] bg-indigo-500 rounded-full"></span>}
      </button>
    );
  };

  if (!user) {
    return <LoginView />;
  }

  // Blocking Maintenance Mode (Only Admin can bypass to continue testing or manage settings)
  if (maintenanceActive && role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC] dark:bg-slate-950 p-6 text-center animate-in fade-in duration-500">
        <div className="max-w-xl bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden flex flex-col items-center">
          {/* Subtle top indicator bar */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-indigo-500"></div>
          
          <div className="bg-indigo-500/10 dark:bg-indigo-400/10 p-5 rounded-3xl border border-indigo-500/20 dark:border-indigo-400/20 mb-6 flex items-center justify-center shadow-inner">
            <Wrench className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-[bounce_2s_infinite]" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter mb-4">
            Plateforme en <span className="text-indigo-600 dark:text-indigo-400">Maintenance</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-8 max-w-md">
            "Le site est actuellement en cours de maintenance planifiée pour l'optimisation des performances de la base de données. Nos équipes techniques s'efforcent de rétablir l'accès complet dans les plus brefs délais. Merci de votre patience."
          </p>

          <div className="w-full pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Diagnostic en cours</span>
            </div>
            
            <span className="text-xs font-semibold text-slate-450 dark:text-slate-400">Résolution estimée : &lt; 1 heure</span>
          </div>
        </div>
        
        {/* Branding Footer */}
        <p className="text-[10px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest mt-8">© 2026 Empreintes Tech. • Tous droits réservés</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans">
      <DataUpdateNotification 
        stats={updateNotificationStats} 
        onClose={() => setUpdateNotificationStats(null)} 
      />
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsCommandPaletteOpen(false);
        }}
        data={data}
      />
      <ExecutiveBriefModal
        isOpen={isExecutiveBriefOpen}
        onClose={() => setIsExecutiveBriefOpen(false)}
        data={data}
      />
      {needsMigration && <MigrationAssistant onMigrationComplete={() => window.location.reload()} />}
      {/* NOTIFICATION DRAWER */}
      {isNotifOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsNotifOpen(false)}></div>
           <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
              <div className="p-6 bg-indigo-700 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                   <Bell className="w-6 h-6" /> Alertes Critiques
                 </h3>
                 <button onClick={() => setIsNotifOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-3 bg-gray-50/50">
                 {globalAlerts.length > 0 ? globalAlerts.map(alert => (
                   <div key={alert.id} onClick={() => handleAlertClick(alert.swo)} className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-rose-500 hover:shadow-md transition-all cursor-pointer group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black px-2 py-1 bg-rose-50 text-rose-600 rounded-lg uppercase tracking-widest">{alert.category}</span>
                        <ShieldAlert className="w-4 h-4 text-rose-300 group-hover:text-rose-500 transition-colors" />
                      </div>
                      <h4 className="font-black text-slate-800 uppercase text-xs">{alert.title}</h4>
                      <p className="text-[11px] text-slate-500 font-bold mt-1">{alert.desc}</p>
                      <div className="mt-3 pt-2 border-t border-dashed flex justify-between items-center">
                         <span className="text-[9px] font-mono text-slate-400">SWO: {alert.swo}</span>
                         <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                   </div>
                 )) : (
                   <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                      <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                      <p className="font-black uppercase tracking-widest text-xs">Aucune alerte active</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* SIDEBAR */}
      {!isMobileOrTablet && (
        <aside className={`fixed inset-y-0 left-0 bg-slate-950 border-r border-slate-900 z-[70] transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 flex flex-col shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.3)] ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden lg:flex absolute -right-3 top-20 bg-slate-900 text-slate-300 p-1 rounded-full border border-slate-800 shadow-lg z-[80] hover:scale-110 active:scale-95 transition-all">
            {isSidebarCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
          </button>

          <div className={`pt-6 pb-4 px-4 flex flex-col items-center transition-all ${isSidebarCollapsed ? 'px-2' : ''}`}>
            <div className="flex items-center gap-3 w-full px-2 py-3 border-b border-slate-900/80 mb-4 justify-start">
              <div className="bg-white p-1 rounded-xl flex items-center justify-center relative shadow-md w-10 h-10 shrink-0 border border-slate-800/50">
                <svg viewBox="0 0 500 500" className="w-full h-full">
                  <defs>
                    <radialGradient id="bg-grad-sidebar" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#1e3a8a" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </radialGradient>

                    <linearGradient id="tech-blue-sidebar" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>

                    <linearGradient id="glow-white-sidebar" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="100%" stopColor="#cbd5e1" />
                    </linearGradient>

                    <filter id="glow-sidebar" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Dark Tech Background Badge */}
                  <circle cx="250" cy="250" r="220" fill="url(#bg-grad-sidebar)" stroke="#38bdf8" strokeWidth="4" strokeOpacity="0.4" />
                  <circle cx="250" cy="250" r="212" fill="none" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.1" />

                  {/* Cloud Outline */}
                  <path d="M 160 280 A 45 45 0 0 1 180 195 A 65 65 0 0 1 305 175 A 50 50 0 0 1 350 250 A 40 40 0 0 1 330 320 L 170 320 A 40 40 0 0 1 160 280 Z" 
                        fill="none" 
                        stroke="url(#tech-blue-sidebar)" 
                        strokeWidth="3" 
                        strokeDasharray="8 4"
                        opacity="0.5" />

                  {/* Data Circuit Lines */}
                  <g stroke="url(#tech-blue-sidebar)" strokeWidth="2" opacity="0.6" fill="none">
                    <path d="M 130 250 L 170 250 M 150 220 L 180 220 M 330 220 L 370 220 M 320 270 L 360 270" />
                    <path d="M 210 140 L 210 170 M 290 135 L 290 165" />
                  </g>

                  {/* Main 'GF' Monogram */}
                  <g filter="url(#glow-sidebar)">
                    <path d="M 225 210 C 180 200, 150 230, 150 265 C 150 305, 185 325, 225 315 L 225 270 L 195 270" 
                          fill="none" 
                          stroke="url(#glow-white-sidebar)" 
                          strokeWidth="14" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" />

                    <path d="M 265 315 L 265 210 L 325 210 M 265 260 L 310 260" 
                          fill="none" 
                          stroke="url(#tech-blue-sidebar)" 
                          strokeWidth="14" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" />
                  </g>

                  {/* Data Nodes */}
                  <g fill="#38bdf8">
                    <circle cx="195" cy="270" r="5" />
                    <circle cx="325" cy="210" r="5" />
                    <circle cx="310" cy="260" r="5" />
                    <circle cx="130" cy="250" r="4" />
                    <circle cx="370" cy="220" r="4" />
                    <circle cx="210" cy="140" r="4" />
                  </g>
                  <g fill="#ffffff">
                    <circle cx="225" cy="210" r="5" />
                    <circle cx="265" cy="315" r="5" />
                  </g>
                </svg>
              </div>
              {!isSidebarCollapsed && (
                <div className="text-left">
                  <h1 className="text-sm font-black tracking-wider text-slate-100 font-display leading-tight uppercase">
                    Global <span className="text-indigo-400">Files</span>
                  </h1>
                  <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider block">Enterprise App</span>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
            {isAdmin && <NavButton id="upload" label="Import Excel" icon={Database} />}
            {data.length > 0 && (
              <>
                {isAdmin && <div className="h-px bg-slate-900/80 my-2 mx-2"></div>}
                <NavButton id="dashboard" label="Analyses Globales" icon={PieChart} />
                <NavButton id="rapport" label="Rapport d'Activité" icon={BarChart3} colorClass="bg-slate-900 text-indigo-400 border border-slate-800/80" isNew={true} />
                <NavButton id="data" label="Row Data" icon={Layout} />
                <NavButton id="daily" label="Daily Status" icon={Calendar} />
                <NavButton id="ttf" label="Analyse TTF" icon={Timer} />
                <NavButton id="gm" label="Feuille GM" icon={Briefcase} />
                <NavButton id="tas" label="Analyse TAS" icon={ClipboardList} />
                <NavButton id="fe_module" label="Module FE" icon={Users} />
                <NavButton id="battery" label="Parc Batteries" icon={Battery} />
                <NavButton id="belt" label="Audit Courroies" icon={Settings2} />
                <div className="h-px bg-slate-900/80 my-3 mx-2"></div>
                <NavButton id="export" label="Pôle d'Exportation" icon={Download} />
                <NavButton id="settings" label="Paramètres du Système" icon={Settings} colorClass="bg-red-500/10 text-red-300 border border-red-950" />
              </>
            )}
          </nav>

          {/* SIDEBAR NOTIFICATION CENTER BUTTON AND LOGOUT */}
          <div className="p-3 border-t border-slate-900/80 bg-slate-950/80 flex flex-col gap-2">
            {data.length > 0 && (
               <button 
                  onClick={() => setIsNotifOpen(true)}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} p-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-900 transition-all group border border-slate-900`}
               >
                  <div className="relative">
                     <Bell className="w-4.5 h-4.5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                     {globalAlerts.length > 0 && (
                       <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[8px] font-bold text-white shadow-lg">
                          {globalAlerts.length}
                       </span>
                     )}
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="text-left">
                      <p className="text-[10px] font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">Alertes Système</p>
                      <p className="text-[8px] font-semibold text-slate-500 uppercase">{globalAlerts.length} anomalies</p>
                    </div>
                  )}
               </button>
            )}

            <button 
               onClick={() => {
                 if (isConfirmingSidebarLogout) {
                   logout();
                 } else {
                   setIsConfirmingSidebarLogout(true);
                   setTimeout(() => setIsConfirmingSidebarLogout(false), 4000);
                 }
               }}
               className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} p-2 rounded-xl transition-all group border ${
                 isConfirmingSidebarLogout 
                   ? 'bg-rose-600 border-rose-700 text-white animate-pulse' 
                   : 'bg-rose-950/20 hover:bg-rose-900/30 border-rose-950/50 hover:border-rose-900'
               }`}
            >
               <LogOut className={`w-4 h-4 ${isConfirmingSidebarLogout ? 'text-white' : 'text-rose-400 group-hover:text-rose-300'} transition-colors`} />
               {!isSidebarCollapsed && (
                 <span className={`text-[10px] font-semibold uppercase tracking-wider ${isConfirmingSidebarLogout ? 'text-white' : 'text-rose-300 group-hover:text-rose-200'}`}>
                   {isConfirmingSidebarLogout ? 'Confirmer ?' : 'Déconnexion'}
                 </span>
               )}
            </button>
            {!isSidebarCollapsed && (
              <div className="text-center mt-2">
                <p className="text-[9px] text-slate-500 font-medium">© 2026 Empreintes Tech.</p>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#f8fafc]">
        {/* Warning banner for administrators when maintenance mode is simulated */}
        {maintenanceActive && role === 'Admin' && (
          <div className="bg-amber-500 text-white font-bold text-[10px] sm:text-xs uppercase tracking-wider py-2 px-4 text-center flex items-center justify-center gap-2 relative z-[100] shadow-sm animate-in slide-in-from-top duration-350 shrink-0">
            <Wrench className="w-3.5 h-3.5 animate-pulse" />
            <span>Mode Maintenance Activé (Visible uniquement par l'administrateur pour tests)</span>
          </div>
        )}

        {/* Dynamic announcement banner for new version releases */}
        {versionAnnounceActive && (
          <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 text-white py-2.5 px-4 relative z-[90] shadow-md flex items-center justify-between gap-4 animate-in slide-in-from-top duration-500 shrink-0">
            <div className="flex items-center gap-3 max-w-4xl mx-auto flex-1">
              <div className="bg-white/10 p-1.5 rounded-lg shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              </div>
              <p className="text-[11px] sm:text-xs font-semibold leading-relaxed">
                <strong className="font-black uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded mr-2 text-[9px]">Mise à jour v3.5.0</strong>
                Basculement automatique de base de données (Firebase / Cloudflare D1), voyant d'état de connexion et affichage mobile optimisé des modules Batterie et Courroie !
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={() => setShowChangelogModal(true)} 
                className="text-[9px] font-black uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-lg transition-all border border-white/10 active:scale-95 cursor-pointer whitespace-nowrap"
              >
                En savoir plus
              </button>
              <button 
                onClick={() => {
                  setVersionAnnounceActive(false);
                  localStorage.setItem('version_announce_dismissed', 'v3.5.0');
                }} 
                className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Fermer l'annonce"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Modal: Interactive Changelog detailing the release content */}
        {showChangelogModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowChangelogModal(false)}></div>
            <div className="relative bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-slate-200/50 animate-in zoom-in-95 duration-300">
              <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100">
                <div className="bg-indigo-500/10 p-2 rounded-xl">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tighter">Nouveautés - Version v3.5.0</h3>
                  <p className="text-[9px] text-indigo-500 font-bold uppercase tracking-widest mt-0.5">Note de version de la plateforme</p>
                </div>
                <button onClick={() => setShowChangelogModal(false)} className="ml-auto p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4 text-[11px] text-slate-600 leading-relaxed max-h-[50vh] overflow-y-auto pr-2">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">🟢 Voyant de Connexion Discret</h4>
                  <p>
                    Le bouton volumineux de connexion a été retiré. Seul un voyant lumineux discret est affiché en haut dans l'en-tête (Vert pour Firebase, Ambre pour Cloudflare D1), offrant une interface épurée tout en indiquant l'état en direct.
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">📱 Rendus Mobiles Batterie & Courroie</h4>
                  <p>
                    Ajustement de la typographie, des paddings et des grilles de cartes KPI au format téléphone portable pour un rendu fluide sans débordement.
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">🔄 Hybrid Data Engine</h4>
                  <p>
                    Synchronisation hybride intelligente avec basculement automatique sans perte de données entre Firebase Firestore et Cloudflare D1.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setShowChangelogModal(false)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
                >
                  Compris, merci
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sleek top header for both mobile & desktop */}
        <header className="bg-white border-b border-slate-200/60 px-3 py-2.5 sm:px-6 sm:py-3.5 flex justify-between items-center z-50 transition-colors shrink-0 w-full">
          <div className="flex items-center gap-2">
            {!isMobileOrTablet && (
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 transition-colors"><Menu className="w-5 h-5" /></button>
            )}
            {isMobileOrTablet && activeTab !== 'portal' && data.length > 0 && (
              <button 
                onClick={() => setActiveTab('portal')}
                className="flex items-center justify-center p-1.5 sm:p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all duration-200 active:scale-95 shadow-sm"
                title="Retour au menu Modules"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5] animate-pulse" />
              </button>
            )}
            <div className="hidden lg:flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Moteur Opérationnel</span>
              </div>

              {/* Discrete DB Connection Status Voyant (Dot only with tooltip) */}
              <div 
                className="flex items-center justify-center p-1 cursor-help"
                title={`Source de données active : ${currentSource}`}
              >
                <span className="flex h-2.5 w-2.5 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    currentSource === 'Firebase' ? 'bg-emerald-400' : currentSource === 'Cloudflare D1' ? 'bg-amber-400' : 'bg-slate-400'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    currentSource === 'Firebase' ? 'bg-emerald-500' : currentSource === 'Cloudflare D1' ? 'bg-amber-500' : 'bg-slate-400'
                  }`}></span>
                </span>
              </div>
            </div>
          </div>
          
          <div className="lg:hidden flex items-center gap-1.5">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 font-display uppercase tracking-wider">
              Global <span className="text-indigo-600">Files</span>
            </h1>
            {/* Discrete DB Connection Status Voyant for mobile (Dot only) */}
            <div 
              className="flex items-center justify-center p-1 cursor-help"
              title={`Source de données active : ${currentSource}`}
            >
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  currentSource === 'Firebase' ? 'bg-emerald-400' : currentSource === 'Cloudflare D1' ? 'bg-amber-400' : 'bg-slate-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  currentSource === 'Firebase' ? 'bg-emerald-500' : currentSource === 'Cloudflare D1' ? 'bg-amber-500' : 'bg-slate-400'
                }`}></span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Quick Command Palette Trigger Button */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Recherche intelligente (Ctrl+K)"
              id="cmd-k-trigger-btn"
            >
              <Command className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden md:inline font-bold">Recherche...</span>
              <kbd className="hidden sm:inline px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-mono text-slate-500">
                Ctrl+K
              </kbd>
            </button>

            {/* Executive Brief Generator Button */}
            {data.length > 0 && (
              <button
                onClick={() => setIsExecutiveBriefOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
                title="Générer la synthèse exécutive"
                id="executive-brief-trigger-btn"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Synthèse Exécutive</span>
              </button>
            )}

            {/* User credentials badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/50 rounded-xl">
              <div className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-600 font-black text-[9px] flex items-center justify-center uppercase">
                {user.email ? user.email[0] : 'U'}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-slate-800 leading-none truncate max-w-[120px]">{user.email}</p>
                <p className="text-[8px] font-bold text-indigo-500 leading-none uppercase mt-0.5">{role || 'Rôle'}</p>
              </div>
            </div>

            <button onClick={() => setIsNotifOpen(true)} className="relative p-2 text-slate-500 hover:text-slate-800 transition-colors duration-200">
              <Bell className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              {globalAlerts.length > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-rose-600 rounded-full"></span>}
            </button>

            {isMobileOrTablet && (
              <button 
                onClick={() => {
                  if (isConfirmingHeaderLogout) {
                    logout();
                  } else {
                    setIsConfirmingHeaderLogout(true);
                    setTimeout(() => setIsConfirmingHeaderLogout(false), 4000);
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all duration-200 active:scale-95 cursor-pointer ${
                  isConfirmingHeaderLogout 
                    ? "bg-rose-600 text-white border-rose-700 animate-pulse" 
                    : "bg-rose-50 border-rose-100 text-rose-600 hover:text-rose-700 hover:bg-rose-100/50"
                }`}
                title={isConfirmingHeaderLogout ? "Confirmer la déconnexion" : `Se déconnecter (${user.email})`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isConfirmingHeaderLogout ? "Confirmer ?" : "Quitter"}</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative bg-[#F8FAFC]">
          <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-indigo-600" /></div>}>
            {isLoading ? (
              <div className="h-full flex flex-col gap-4 items-center justify-center text-indigo-400">
                <Loader2 className="w-12 h-12 animate-spin" />
                <p className="font-bold animate-pulse">Chargement des données depuis Row Data...</p>
              </div>
            ) : (
              <>
                {activeTab === 'upload' && isAdmin && <div className="h-full flex items-center justify-center p-6"><FileUpload existingDataCount={data.length} onDataLoaded={handleDataLoaded} /></div>}
                {data.length > 0 ? (
                  <div className="h-full">
                    {activeTab === 'portal' && (
                      <div className="overflow-auto h-full bg-slate-50 dark:bg-slate-950">
                        <MobilePortal 
                          role={role}
                          activeTab={activeTab}
                          onSelectTab={setActiveTab}
                          dataCount={data.length}
                          alertsCount={globalAlerts.length}
                          onOpenAlerts={() => setIsNotifOpen(true)}
                          onLogout={logout}
                        />
                      </div>
                    )}
                    {activeTab === 'dashboard' && <div className="overflow-auto h-full"><Dashboard data={data} onFilterChange={(col, val) => setFilters(prev => ({ ...prev, [col]: val }))} onSwitchToData={() => setActiveTab('data')} /></div>}
                    {activeTab === 'rapport' && <div className="overflow-auto h-full"><ActivityReport data={data} /></div>}
                    {activeTab === 'data' && <div className="p-6 h-full"><DataTable data={data} setData={setData} onUpdateRow={(idx, f, v) => setData(prev => { const n = [...prev]; n[idx] = { ...n[idx], [f]: v }; return n; })} filters={filters} onFilterChange={(c, v) => setFilters(prev => ({ ...prev, [c]: v }))} onApplyFilters={setFilters} onSaveDatabase={handleSaveFullDatabase} canEdit={isAdmin || isManager} /></div>}
                    {activeTab === 'daily' && <div className="overflow-auto h-full"><DailyStatus data={data} onFilterChange={(c, v) => setFilters(prev => ({ ...prev, [c]: v }))} onSwitchToData={() => setActiveTab('data')} /></div>}
                    {activeTab === 'ttf' && <div className="overflow-auto h-full"><TTFAnalysis data={data} onFilterChange={(c, v) => setFilters(prev => ({ ...prev, [c]: v }))} onSwitchToData={() => setActiveTab('data')} /></div>}
                    {activeTab === 'gm' && <div className="overflow-auto h-full"><GMSheet data={data} onFilterChange={(c, v) => setFilters(prev => ({ ...prev, [c]: v }))} onSwitchToData={() => setActiveTab('data')} /></div>}
                    {activeTab === 'tas' && <div className="overflow-auto h-full"><TASAnalysis data={data} onFilterChange={(c, v) => setFilters(prev => ({ ...prev, [c]: v }))} onSwitchToData={() => setActiveTab('data')} /></div>}
                    {activeTab === 'fe_module' && <div className="overflow-auto h-full"><FEModule data={data} onFilterChange={(c, v) => setFilters(prev => ({ ...prev, [c]: v }))} onSwitchToData={() => setActiveTab('data')} /></div>}
                    {activeTab === 'battery' && <div className="overflow-auto h-full"><BatteryTracker data={data} thresholdMonths={batteryThreshold} /></div>}
                    {activeTab === 'belt' && <div className="overflow-auto h-full"><BeltTracker data={data} thresholdDays={beltThreshold} /></div>}
                    {activeTab === 'export' && <div className="overflow-auto h-full"><ExportManager allData={data} filteredData={filteredData} onImport={(data) => handleDataLoaded(data, false)} isAdmin={isAdmin} /></div>}
                    {activeTab === 'settings' && (
                      <div className="overflow-y-auto h-full custom-scrollbar">
                        <SettingsPanel 
                          initialBatteryThreshold={batteryThreshold}
                          initialBeltThreshold={beltThreshold}
                          onSave={handleSaveSettings}
                          data={data}
                          setData={setData}
                          onSetActiveTab={setActiveTab}
                          isNightMode={isNightMode}
                          setIsNightMode={setIsNightMode}
                          themeMode={themeMode}
                          setThemeMode={setThemeMode}
                          userRole={role}
                          maintenanceActive={maintenanceActive}
                          setMaintenanceActive={setMaintenanceActive}
                          versionAnnounceActive={versionAnnounceActive}
                          setVersionAnnounceActive={setVersionAnnounceActive}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  !isManager && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                      <Database className="w-16 h-16 opacity-20" />
                      <p className="font-bold text-lg">Aucune donnée n'est actuellement disponible.</p>
                      <p className="text-sm">Veuillez patienter qu'un administrateur importe des données.</p>
                    </div>
                  )
                )}
              </>
            )}
          </Suspense>
        </main>
      </div>
      
      {/* DATABASE QUOTA EXCEEDED ERROR MODAL */}
      {dbQuotaError && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDbQuotaError(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 max-w-lg w-full border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
            <h4 className="text-2xl font-black text-rose-600 dark:text-rose-500 flex items-center gap-3 mb-4">
              <ShieldAlert className="w-8 h-8 text-rose-500 animate-pulse" />
              <span>Quota Firestore Dépassé</span>
            </h4>
            <div className="space-y-4 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              <p>
                L'application a temporairement épuisé son quota gratuit quotidien de lecture ou d'écriture de la base de données Firestore (sous le forfait gratuit <strong>Firebase Spark</strong>).
              </p>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl flex gap-3">
                <Sparkles className="w-8 h-8 text-indigo-500 shrink-0 animate-bounce" />
                <div>
                  <h5 className="font-extrabold text-indigo-950 dark:text-indigo-200 text-xs uppercase tracking-wide mb-1">Solution de secours immédiate !</h5>
                  <p className="text-indigo-900 dark:text-indigo-300 text-xs">
                    Vous pouvez activer instantanément le <strong>Mode Cloudflare D1 Forcé</strong> ci-dessous. Toutes les données seront chargées de manière transparente et illimitée depuis notre infrastructure Cloudflare de secours, résolvant complètement ce problème de quota !
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-[11px] text-rose-900 dark:text-rose-300 font-bold space-y-2 my-5">
              <p>
                Pour réactiver définitivement votre base de données principale, vous pouvez également changer de forfait :
              </p>
              <p className="pt-1">
                👉 <a 
                  href="https://console.firebase.google.com/project/planar-matter-rms1d/firestore/databases/ai-studio-globalfilesenter-55247b97-af2f-4aa6-bb70-97bd3c9ee603/data?openUpgradeDialog=true" 
                  target="_blank" 
                  referrerPolicy="no-referrer"
                  rel="noopener noreferrer" 
                  className="underline font-extrabold text-rose-950 dark:text-rose-200 hover:text-rose-800"
                >
                  Ouvrir la Console Firebase du projet (Option Upgrade)
                </a>
              </p>
              <p>
                🎨 <a href="https://firebase.google.com/pricing#cloud-firestore" target="_blank" rel="noopener noreferrer" className="underline font-extrabold text-rose-950 dark:text-rose-200 hover:text-rose-800">
                  Consulter les détails des tarifs Spark vs Blaze (Enterprise)
                </a>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={async () => {
                  try {
                    const { resetQuotaOverride } = await import('./firebaseData');
                    const { resetQuotaStatus } = await import('./firebase');
                    resetQuotaOverride();
                    resetQuotaStatus();
                  } catch {}
                  setDbQuotaError(false);
                  window.location.reload();
                }}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition text-sm shadow-md active:scale-95 duration-150 flex-1 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Réessayer la Connexion Firebase (Multi-appareils)
              </button>
              <button
                onClick={() => setDbQuotaError(false)}
                className="px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-extrabold rounded-xl transition text-sm active:scale-95 duration-150"
              >
                Continuer en Mode Secours (D1)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
};

export default App;
