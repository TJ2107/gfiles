export const parseDate = (val: string | number | Date | null | undefined): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(Math.round((val - 25569) * 86400 * 1000));
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Handle stringified Excel serial numbers (e.g. "45609.7543402778")
    if (!isNaN(Number(trimmed)) && !trimmed.includes('/')) {
      return new Date(Math.round((Number(trimmed) - 25569) * 86400 * 1000));
    }

    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        // Handle year potentially having time attached (e.g. "2023 12:00:00")
        const yPart = parts[2].split(' ')[0];
        const y = parseInt(yPart);
        return new Date(y, m, d);
      }
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

export const formatDate = (date: string | number | Date | null | undefined): string => {
  const d = parseDate(date);
  if (!d) return "-";
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
