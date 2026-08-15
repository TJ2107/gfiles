import React from 'react';
import { toJpeg, toPng } from 'html-to-image';

/**
 * Télécharge un graphique Recharts (SVG) en JPG
 */
export const downloadChartAsJpg = (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
  if (!ref.current) return;

  const svgElement = ref.current.querySelector('svg');
  if (!svgElement) {
    console.error("Élément SVG introuvable pour le graphique");
    return;
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const { width, height } = svgElement.getBoundingClientRect();

  const canvas = document.createElement('canvas');
  const scale = 2; 
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return;
  
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const img = new Image();
  const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const link = document.createElement('a');
    link.download = `${filename}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  };

  img.src = url;
};

/**
 * Télécharge un tableau HTML en JPG
 */
export const downloadTableAsJpg = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
  if (!ref.current) return;

  try {
    const dataUrl = await toJpeg(ref.current, {
      quality: 0.98,
      pixelRatio: 2.5,
      backgroundColor: '#ffffff',
      style: {
        borderRadius: '0px',
      }
    });

    const link = document.createElement('a');
    link.download = `${filename}.jpg`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Erreur lors de la capture du tableau:', error);
    alert('Une erreur est survenue lors de la génération de l\'image du tableau.');
  }
};

/**
 * Télécharge ou partage un composant HTML sous format PNG (Haute Définition Ultra-HD)
 */
export const shareOrDownloadElementAsPng = async (ref: React.RefObject<HTMLDivElement | null>, filename: string, title?: string) => {
  if (!ref.current) return;

  try {
    const dataUrl = await toPng(ref.current, {
      quality: 1,
      pixelRatio: 2.5, // Force 2.5x High-DPI resolution for crisp text & graphics
      cacheBust: true,
      backgroundColor: '#ffffff',
      style: {
        borderRadius: '16px',
        padding: '12px'
      }
    });

    // Try Web Share API if available
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${filename}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: title || 'Daily Plan',
          text: `Daily Plan (${filename}) - Global Files`,
          files: [file]
        });
        return;
      }
    } catch {
      // Fallback to direct download
    }

    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') return;
    console.error('Erreur lors de la génération du PNG:', error);
    alert('Une erreur est survenue lors de la génération de l\'image PNG.');
  }
};
