
import React, { useMemo, useRef, useState } from 'react';
import { GlobalFileRow, XStatus } from '../types';
import { X_OPTIONS } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { ThreeDBarVertical } from './ThreeDShapes';
import { 
  Camera, ArrowRightLeft, Calendar, TrendingUp, TrendingDown, Minus, 
  Battery, AlertTriangle, Database, Layers, CheckSquare
} from 'lucide-react';
import { downloadChartAsJpg, downloadTableAsJpg } from '../utils/chartHelpers';
import { parseDate } from '../utils/dateHelpers';

interface DashboardProps {
  data: GlobalFileRow[];
  onFilterChange: (column: string, value: string) => void;
  onSwitchToData: () => void;
}



const X_COLORS: Record<string, string> = {
  [XStatus.CLOSED]: "#10B981",
  [XStatus.TVX_STHIC]: "#6366f1", 
  [XStatus.STHIC_SPA]: "#3b82f6",
  [XStatus.STHIC_ATV_HTC]: "#F59E0B",
  [XStatus.HTC]: "#f97316",
  "Autre": "#94A3B8"
};

const toInputDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const Dashboard: React.FC<DashboardProps> = ({ data, onFilterChange, onSwitchToData }) => {
  const pieChartRef = useRef<HTMLDivElement>(null);
  const regionChartRef = useRef<HTMLDivElement>(null);
  const compareTableRef = useRef<HTMLDivElement>(null);

  const [dateA, setDateA] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toInputDate(d);
  });
  const [dateB, setDateB] = useState(toInputDate(new Date()));

  const handleChartClick = (entry: { name: string }, column: string) => {
     const name = entry?.name || entry?.activePayload?.[0]?.payload?.region || entry?.activePayload?.[0]?.payload?.name;
     if (name) {
       onFilterChange(column, name);
       onSwitchToData();
     }
  };

  const statsByX = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!data || !Array.isArray(data)) return [];
    data.forEach(row => {
      if (!row) return;
      const x = String(row["X"] || row["x-Value"] || row["x_Value"] || row["X Status"] || row["State SWO"] || row["TAS Status"] || "Non défini");
      counts[x] = (counts[x] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, count: counts[key] }));
  }, [data]);

  const pivotTableData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    const distinctRegions = Array.from(new Set(data.map(d => String((d && d["Region"]) || "Non défini")))).sort();
    return distinctRegions.map(region => {
      const regionData = data.filter(d => d && String(d["Region"] || "Non défini") === region);
      const countsByX: Record<string, number> = {};
      X_OPTIONS.forEach(opt => countsByX[opt] = 0);
      countsByX["Autre"] = 0;
      regionData.forEach(row => {
        const xVal = row["X"] || row["x-Value"] || row["x_Value"] || row["X Status"] || row["State SWO"] || row["TAS Status"];
        if (xVal && X_OPTIONS.includes(xVal as XStatus)) countsByX[String(xVal)] = (countsByX[String(xVal)] || 0) + 1;
        else countsByX["Autre"] = (countsByX["Autre"] || 0) + 1;
      });
      return { region, ...countsByX, total: regionData.length };
    }).sort((a, b) => b.total - a.total);
  }, [data]);

  const batteryStats = useMemo(() => {
    const sitesMap: Record<string, Date> = {};
    const now = new Date();
    if (!data || !Array.isArray(data)) return { green: 0, orange: 0, red: 0, series: [] };
    
    data.forEach(row => {
      if (!row) return;
      const desc = String(row["Description"] || "").toLowerCase();
      const status = String(row["State SWO"] || row["status"] || "").toUpperCase();
      
      const keywords = [
        "swap battery ge", 
        "remplacement batterie ge", 
        "remplacement battery ge"
      ];
      const isBatteryTask = keywords.some(k => desc.includes(k));
      const isClosed = status === "CLOSED";

      if (isBatteryTask && isClosed) {
        const site = String(row["Nom du site"] || "Inconnu");
        const date = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
        if (date && (!sitesMap[site] || date > sitesMap[site])) sitesMap[site] = date;
      }
    });
    const values = Object.values(sitesMap);
    const red = values.filter(d => {
        const diff = (now.getMonth() - d.getMonth() + 12 * (now.getFullYear() - d.getFullYear()));
        return diff >= 7;
    }).length;
    const orange = values.filter(d => {
        const diff = (now.getMonth() - d.getMonth() + 12 * (now.getFullYear() - d.getFullYear()));
        return diff >= 6 && diff < 7;
    }).length;
    const green = values.length - red - orange;
    const percentHealthy = values.length > 0 ? Math.round((green / values.length) * 100) : 100;
    return { total: values.length, red, orange, green, percentHealthy };
  }, [data]);

  const KPICard = ({ title, value, icon: Icon, colorClass, subtitle }: { title: string; value: string | number; icon: React.ElementType; colorClass: string; subtitle?: string }) => (
    <div className={`relative bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden group hover:shadow-xl transition-all duration-500`}>
      <div className="relative z-10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <h4 className={`text-4xl font-black tracking-tighter ${colorClass}`}>{value}</h4>
          {subtitle && <span className="text-xs font-bold text-slate-400">{subtitle}</span>}
        </div>
      </div>
      <div className={`absolute -right-4 -bottom-4 opacity-[0.05] group-hover:opacity-[0.08] transition-opacity duration-500`}>
        <Icon className="w-32 h-32 rotate-12" />
      </div>
      <div className={`absolute top-0 left-0 w-1.5 h-full ${colorClass.replace('text-', 'bg-')}`}></div>
    </div>
  );

  const comparisonData = useMemo(() => {
    if (!data || !Array.isArray(data)) return { periodA: [], periodB: [] };
    const getFluxStats = (dateStr: string) => {
      const targetDate = new Date(dateStr);
      targetDate.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);
      const regionMap: Record<string, Record<string, number>> = {};
      data.forEach(row => {
        if (!row) return;
        const creationDate = parseDate(row["Date de création du SWO"]);
        const closingDate = parseDate(row["Closing date"]) || parseDate(row["Date de Clôture"]);
        const reg = String(row["Region"] || "Non défini");
        const xVal = String(row["X"] || "Autre");
        if (!regionMap[reg]) {
          regionMap[reg] = { total: 0 } as Record<string, number>;
          X_OPTIONS.forEach(opt => regionMap[reg][opt] = 0);
        }
        if (xVal === XStatus.CLOSED) {
          if (closingDate && closingDate >= targetDate && closingDate <= endOfDay) {
            regionMap[reg][XStatus.CLOSED]++;
            regionMap[reg].total++;
          }
        } 
        else {
          if (creationDate && creationDate >= targetDate && creationDate <= endOfDay) {
            if (X_OPTIONS.includes(xVal as XStatus)) regionMap[reg][xVal]++;
            regionMap[reg].total++;
          }
        }
      });
      return regionMap;
    };
    const statsA = getFluxStats(dateA);
    const statsB = getFluxStats(dateB);
    const regions = Array.from(new Set([...Object.keys(statsA), ...Object.keys(statsB)])).sort();
    return regions.map(reg => ({
      region: reg,
      dataA: statsA[reg] || { total: 0, ...Object.fromEntries(X_OPTIONS.map(o => [o, 0])) },
      dataB: statsB[reg] || { total: 0, ...Object.fromEntries(X_OPTIONS.map(o => [o, 0])) }
    }));
  }, [data, dateA, dateB]);

  const totalsCompare = useMemo(() => {
    const sums = {
      dataA: { total: 0, ...Object.fromEntries(X_OPTIONS.map(o => [o, 0])) },
      dataB: { total: 0, ...Object.fromEntries(X_OPTIONS.map(o => [o, 0])) }
    };
    comparisonData.forEach(row => {
      sums.dataA.total += row.dataA.total;
      sums.dataB.total += row.dataB.total;
      X_OPTIONS.forEach(opt => {
        (sums.dataA as Record<string, number>)[opt] += (row.dataA as Record<string, number>)[opt];
        (sums.dataB as Record<string, number>)[opt] += (row.dataB as Record<string, number>)[opt];
      });
    });
    return sums;
  }, [comparisonData]);

  const TrendIcon = ({ a, b, isClosed }: { a: number, b: number, isClosed: boolean }) => {
    if (a === b) return <Minus className="w-3 h-3 text-slate-300" />;
    if (isClosed) return b > a ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />;
    return b > a ? <TrendingUp className="w-3 h-3 text-red-500" /> : <TrendingDown className="w-3 h-3 text-emerald-500" />;
  };

  const dossiersOuvertsTVX_SPA = useMemo(() => {
    if (!data || !Array.isArray(data)) return 0;
    return data.filter(d => {
      if (!d) return false;
      const x = String(d["X"] || "");
      return x === XStatus.TVX_STHIC || x === XStatus.STHIC_SPA;
    }).length;
  }, [data]);

  const dossiersCloturesX = useMemo(() => {
    if (!data || !Array.isArray(data)) return 0;
    return data.filter(d => d && String(d["X"] || "") === XStatus.CLOSED).length;
  }, [data]);

  const htcCount = useMemo(() => {
    if (!data || !Array.isArray(data)) return 0;
    return data.filter(d => d && String(d["X"] || "").includes("HTC")).length;
  }, [data]);

  return (
    <div className="p-6 space-y-8 bg-[#F8FAFC] min-h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Analytics <span className="text-indigo-600">Overview</span></h2>
          <p className="text-sm font-medium text-slate-400 mt-1">Données compilées et intelligence opérationnelle en temps réel.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-5 py-2.5 rounded-2xl text-slate-700 shadow-sm">
           <Calendar className="w-4 h-4 text-indigo-600" />
           <span className="text-xs font-black uppercase tracking-widest">{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric'})}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Total SWO Database" value={Array.isArray(data) ? data.length : 0} icon={Database} colorClass="text-slate-900" />
        <KPICard 
          title="Dossiers Ouverts (TVX+SPA)" 
          value={dossiersOuvertsTVX_SPA} 
          icon={Layers} 
          colorClass="text-blue-600" 
          subtitle="En production"
        />
        <KPICard 
          title="Dossiers Clôturés" 
          value={dossiersCloturesX} 
          icon={CheckSquare} 
          colorClass="text-emerald-600" 
          subtitle="Statut 1- CLOSED"
        />
        <KPICard title="Urgences HTC (Priorité)" value={htcCount} icon={AlertTriangle} colorClass="text-orange-600" />
      </div>

      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col lg:flex-row items-center gap-10 group transition-all duration-500 hover:shadow-2xl">
        <div className="lg:w-1/3 flex flex-col items-center lg:items-start text-center lg:text-left gap-4">
           <div className="bg-indigo-50 p-4 rounded-3xl group-hover:bg-indigo-600 transition-colors duration-500">
             <Battery className="w-10 h-10 text-indigo-600 group-hover:text-white transition-colors duration-500" />
           </div>
           <div>
             <h3 className="text-2xl font-black text-slate-900 tracking-tight">Santé Batteries GE</h3>
             <p className="text-sm text-slate-400 font-medium">Conformité basée sur le cycle de 7 mois.</p>
           </div>
           <div className="bg-indigo-50/50 px-6 py-2 rounded-2xl border border-indigo-100">
              <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Score de Parc</span>
              <p className="text-3xl font-black text-indigo-700">{batteryStats.percentHealthy}%</p>
           </div>
        </div>
        
        <div className="flex-1 w-full space-y-6">
           <div className="relative pt-1">
              <div className="flex mb-3 items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Maintenance Requis</span>
                <span>Conformité Optimale</span>
              </div>
              <div className="overflow-hidden h-4 text-xs flex rounded-full bg-slate-100 shadow-inner">
                 <div style={{ width: `${(batteryStats.green / batteryStats.total) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500 transition-all duration-1000"></div>
                 <div style={{ width: `${(batteryStats.orange / batteryStats.total) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-amber-500 transition-all duration-1000"></div>
                 <div style={{ width: `${(batteryStats.red / batteryStats.total) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-rose-500 transition-all duration-1000"></div>
              </div>
           </div>
           
           <div className="grid grid-cols-3 gap-4">
              <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100 text-center transition-transform hover:scale-105">
                <p className="text-2xl font-black text-emerald-700">{batteryStats.green}</p>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Opérationnel</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-3xl border border-amber-100 text-center transition-transform hover:scale-105">
                <p className="text-2xl font-black text-amber-700">{batteryStats.orange}</p>
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">À Prévoir</p>
              </div>
              <div className="bg-rose-50 p-4 rounded-3xl border border-rose-100 text-center transition-transform hover:scale-105">
                <p className="text-2xl font-black text-rose-700">{batteryStats.red}</p>
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Critique</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Fixation de la hauteur du conteneur parent à 450px */}
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col h-[450px]" ref={pieChartRef}>
          <div className="flex justify-between items-center mb-8 shrink-0">
             <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
               <Layers className="w-6 h-6 text-indigo-500" />
               Mix Opérationnel (X)
             </h3>
             <button onClick={() => downloadChartAsJpg(pieChartRef, 'statut_x')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all"><Camera className="w-5 h-5" /></button>
          </div>
          <div className="h-[320px] w-full relative">
            <ResponsiveContainer width="99%" height={320}>
              <PieChart>
                <Pie data={statsByX} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5} onClick={(data) => handleChartClick(data, "X")} className="cursor-pointer">
                  {statsByX.map((entry, index) => <Cell key={`cell-${index}`} fill={X_COLORS[entry.name] || '#8884d8'} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col h-[450px]" ref={regionChartRef}>
          <div className="flex justify-between items-center mb-8 shrink-0">
             <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
               <Layers className="w-6 h-6 text-indigo-500" />
               Production Globale par Région
             </h3>
             <button onClick={() => downloadChartAsJpg(regionChartRef, 'production_region')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all"><Camera className="w-5 h-5" /></button>
          </div>
          <div className="h-[320px] w-full relative">
            <ResponsiveContainer width="99%" height={320}>
              <BarChart data={pivotTableData} margin={{ bottom: 40 }} onClick={(e) => handleChartClick(e, "Region")}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="region" tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} angle={-45} textAnchor="end" height={80} interval={0} />
                <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }} />
                <Legend iconType="circle" verticalAlign="top" height={36}/>
                {X_OPTIONS.map(opt => (
                  <Bar key={opt} dataKey={opt} stackId="a" fill={X_COLORS[opt]} cursor="pointer" shape={<ThreeDBarVertical />} />
                ))}
                <Bar dataKey="Autre" stackId="a" fill={X_COLORS["Autre"]} cursor="pointer" shape={<ThreeDBarVertical />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col" ref={compareTableRef}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
              <ArrowRightLeft className="w-7 h-7 text-indigo-600" />
              Évolution Temporelle des Flux
            </h3>
            <p className="text-sm font-medium text-slate-400 mt-1 uppercase tracking-widest">Comparaison dynamique de la production.</p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-inner">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Date (A)</span>
              <input type="date" className="border-none bg-transparent text-sm font-black focus:ring-0 cursor-pointer text-slate-700" value={dateA} onChange={(e) => setDateA(e.target.value)} />
            </div>
            <div className="px-2 text-slate-300"><ArrowRightLeft className="w-4 h-4" /></div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Target Date (B)</span>
              <input type="date" className="border-none bg-transparent text-sm font-black text-indigo-600 focus:ring-0 cursor-pointer" value={dateB} onChange={(e) => setDateB(e.target.value)} />
            </div>
            <button onClick={() => downloadTableAsJpg(compareTableRef, 'evolution_quotidienne')} className="ml-4 p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-100 transition shadow-sm text-slate-500"><Camera className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[2.5rem] border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.04),_0_1px_2px_rgba(0,0,0,0.02),_inset_0_1px_2px_rgba(255,255,255,0.8)] hover:shadow-[0_30px_60px_rgba(99,102,241,0.08),_0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-500 overflow-hidden bg-white">
          <table className="min-w-full text-[11px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-6 py-6 border-r border-slate-800 sticky left-0 bg-slate-900 z-10 text-white font-black uppercase tracking-widest" rowSpan={2}>Région</th>
                {X_OPTIONS.map(opt => (
                  <th key={opt} className="px-2 py-4 border-r border-slate-800 text-center uppercase tracking-tighter text-[10px]" colSpan={2} style={{ backgroundColor: X_COLORS[opt], color: opt === XStatus.STHIC_ATV_HTC ? 'black' : 'white' }}>{opt}</th>
                ))}
                <th className="px-6 py-4 border-l border-slate-800 text-center bg-slate-800 text-white font-black" colSpan={2}>Global Flow</th>
              </tr>
              <tr className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                {X_OPTIONS.map(opt => (
                  <React.Fragment key={`${opt}-sub`}>
                    <th className="px-2 py-3 border-r border-slate-100 text-center">A</th>
                    <th className="px-2 py-3 border-r border-slate-100 text-center bg-indigo-50/30 text-indigo-600">B</th>
                  </React.Fragment>
                ))}
                <th className="px-2 py-3 border-r border-slate-100 text-center">A</th>
                <th className="px-2 py-3 text-center bg-indigo-50 text-indigo-700">B</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparisonData.map((row, idx) => (
                <tr key={row.region} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'} hover:bg-indigo-50/30 transition-colors`}>
                  <td className="px-6 py-4 border-r font-black text-slate-700 sticky left-0 bg-inherit z-10 uppercase tracking-tight">{row.region}</td>
                  {X_OPTIONS.map(opt => {
                    const valA = (row.dataA as Record<string, number>)[opt] || 0;
                    const valB = (row.dataB as Record<string, number>)[opt] || 0;
                    return (
                      <React.Fragment key={`${row.region}-${opt}`}>
                        <td className="px-2 py-4 border-r text-center text-slate-300">{valA || '-'}</td>
                        <td className="px-2 py-4 border-r text-center font-bold">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={valB > 0 ? 'text-slate-900 font-black' : 'text-slate-200'}>{valB || '-'}</span>
                            {(valA > 0 || valB > 0) && <TrendIcon a={valA} b={valB} isClosed={opt === XStatus.CLOSED} />}
                          </div>
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="px-2 py-4 border-r text-center font-black text-slate-400">{row.dataA.total}</td>
                  <td className="px-2 py-4 text-center font-black text-indigo-700 bg-indigo-50/20">
                    <div className="flex items-center justify-center gap-1.5">
                      {row.dataB.total}
                      {(row.dataA.total > 0 || row.dataB.total > 0) && <TrendIcon a={row.dataA.total} b={row.dataB.total} isClosed={false} />}
                    </div>
                  </td>
                </tr>
              ))}
              {comparisonData.length > 0 && (
                <tr className="bg-slate-900 text-white font-black text-xs uppercase tracking-widest">
                  <td className="px-6 py-6 border-r border-slate-800 sticky left-0 bg-slate-900 z-10 text-right">TOTAL CONSOLIDÉ</td>
                  {X_OPTIONS.map(opt => {
                    const sumA = (totalsCompare.dataA as Record<string, number>)[opt];
                    const sumB = (totalsCompare.dataB as Record<string, number>)[opt];
                    return (
                      <React.Fragment key={`total-${opt}`}>
                        <td className="px-2 py-6 border-r border-slate-800 text-center opacity-40">{sumA}</td>
                        <td className="px-2 py-6 border-r border-slate-800 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {sumB}
                            <TrendIcon a={sumA} b={sumB} isClosed={opt === XStatus.CLOSED} />
                          </div>
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="px-2 py-6 border-r border-slate-800 text-center opacity-40">{totalsCompare.dataA.total}</td>
                  <td className="px-2 py-6 text-center bg-indigo-700 font-black">
                    <div className="flex items-center justify-center gap-2">
                      {totalsCompare.dataB.total}
                      <TrendIcon a={totalsCompare.dataA.total} b={totalsCompare.dataB.total} isClosed={false} />
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
