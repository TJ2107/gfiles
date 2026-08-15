import React, { useEffect, useRef, useMemo } from 'react';
import * as L from 'leaflet';
import { GlobalFileRow } from '../types';
import { REGION_COORDINATES } from '../constants';
import { Map as MapIcon, Info, Compass } from 'lucide-react';

interface SiteMapProps {
  data: GlobalFileRow[];
  filters: Record<string, string>;
}

const normalizeRegionName = (name: string): string => {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z]/g, "")
    .trim();
};

const CONGO_CENTER: [number, number] = [-0.228, 15.827];
const DEFAULT_ZOOM = 6;

export const SiteMap: React.FC<SiteMapProps> = ({ data, filters }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  const filteredData = useMemo(() => {
    return data.filter(row => {
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

  const siteStats = useMemo(() => {
    const sites: Record<string, { 
      name: string, 
      region: string, 
      normalizedRegion: string,
      open: number, 
      closed: number,
      total: number
    }> = {};

    filteredData.forEach(row => {
      const siteName = String(row["Nom du site"] || "Inconnu");
      const region = String(row["Region"] || "Inconnu");
      const state = String(row["State SWO"] || "").toUpperCase();

      if (!sites[siteName]) {
        sites[siteName] = { 
          name: siteName, 
          region, 
          normalizedRegion: normalizeRegionName(region),
          open: 0, 
          closed: 0, 
          total: 0 
        };
      }

      sites[siteName].total++;
      if (state === "OPEN") sites[siteName].open++;
      else if (state === "CLOSED") sites[siteName].closed++;
    });

    return Object.values(sites);
  }, [filteredData]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView(CONGO_CENTER, DEFAULT_ZOOM);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(mapRef.current);

      markersRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const map = mapRef.current;
    const markers = markersRef.current;

    // Force la carte à se redimensionner quand son conteneur change
    const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    if (markers) {
      markers.clearLayers();
      siteStats.forEach(site => {
        const coords = REGION_COORDINATES[site.normalizedRegion];
        if (coords) {
          const jitterLat = (Math.random() - 0.5) * 0.12;
          const jitterLng = (Math.random() - 0.5) * 0.12;
          const finalCoords: [number, number] = [coords[0] + jitterLat, coords[1] + jitterLng];
          const color = site.open > 0 ? '#ef4444' : '#22c55e';
          
          const markerIcon = L.divIcon({
            html: `<div style="background-color: ${color}; width: 15px; height: 15px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.4);"></div>`,
            className: 'custom-map-marker',
            iconSize: [15, 15],
            iconAnchor: [7.5, 7.5]
          });

          L.marker(finalCoords, { icon: markerIcon })
            .bindPopup(`
              <div style="font-family: sans-serif; min-width: 150px;">
                <div style="font-weight: 800; border-bottom: 1px solid #ddd; margin-bottom: 5px;">${site.name}</div>
                <div style="font-size: 12px;">Département: ${site.region}</div>
                <div style="font-size: 12px; margin-top: 4px;">Ouverts: <b style="color: #ef4444;">${site.open}</b></div>
                <div style="font-size: 12px;">Fermés: <b style="color: #22c55e;">${site.closed}</b></div>
              </div>
            `)
            .addTo(markers);
        }
      });
    }

    return () => resizeObserver.disconnect();
  }, [siteStats, mapContainerRef, mapRef, markersRef]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <MapIcon className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-bold">Carte des Sites (Congo-Brazzaville)</h2>
        </div>
        <button onClick={() => mapRef.current?.setView(CONGO_CENTER, DEFAULT_ZOOM)} className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg text-xs font-bold shadow-sm hover:bg-gray-50 transition"><Compass className="w-3.5 h-3.5" /> Recentrer</button>
      </div>
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0 z-10 w-full h-full" />
      </div>
      <div className="p-3 bg-indigo-50 border-t flex items-center gap-2 text-[10px] text-indigo-500 font-medium">
        <Info className="w-3.5 h-3.5" />
        <span>Positionnement par département. Rouge = au moins un SWO ouvert. Vert = tout est fermé.</span>
      </div>
    </div>
  );
};