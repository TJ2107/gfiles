import { GlobalFileRow } from '../types';
import { DataUpdateStats } from '../components/DataUpdateNotification';

export function computeDataDiffStats(
  existingData: GlobalFileRow[],
  newData: GlobalFileRow[],
  isAppend: boolean = true
): DataUpdateStats {
  // Extract set of existing non-empty column keys
  const existingColsSet = new Set<string>();
  existingData.forEach(row => {
    if (!row) return;
    Object.keys(row).forEach(key => {
      if (key && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        existingColsSet.add(key);
      }
    });
  });

  // Extract set of incoming non-empty column keys
  const incomingColsSet = new Set<string>();
  newData.forEach(row => {
    if (!row) return;
    Object.keys(row).forEach(key => {
      if (key && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        incomingColsSet.add(key);
      }
    });
  });

  let addedColumnsCount = 0;
  let updatedColumnsCount = 0;

  if (existingData.length === 0) {
    // Brand new database initialization
    addedColumnsCount = incomingColsSet.size;
    updatedColumnsCount = 0;
  } else {
    incomingColsSet.forEach(col => {
      if (!existingColsSet.has(col)) {
        addedColumnsCount++;
      } else {
        updatedColumnsCount++;
      }
    });
  }

  // Calculate row additions / modifications
  let updatedRowsCount = 0;
  let addedRowsCount = 0;

  if (!isAppend || existingData.length === 0) {
    addedRowsCount = newData.length;
    updatedRowsCount = 0;
  } else {
    const existingKeys = new Set<string>();
    existingData.forEach(r => {
      if (!r) return;
      const swo = r["N° SWO"] ? String(r["N° SWO"]).trim() : "";
      const pm = r["PM number"] ? String(r["PM number"]).trim() : "";
      if (swo) existingKeys.add(`swo:${swo}`);
      if (pm) existingKeys.add(`pm:${pm}`);
    });

    newData.forEach(row => {
      if (!row) return;
      const swo = row["N° SWO"] ? String(row["N° SWO"]).trim() : "";
      const pm = row["PM number"] ? String(row["PM number"]).trim() : "";
      const matchSwo = swo && existingKeys.has(`swo:${swo}`);
      const matchPm = pm && existingKeys.has(`pm:${pm}`);

      if (matchSwo || matchPm) {
        updatedRowsCount++;
      } else {
        addedRowsCount++;
      }
    });
  }

  return {
    updatedColumnsCount,
    addedColumnsCount,
    updatedRowsCount,
    addedRowsCount,
    totalRows: isAppend ? existingData.length + addedRowsCount : newData.length,
    timestamp: new Date()
  };
}

export function triggerDataUpdateNotification(stats: DataUpdateStats) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('show-data-update-notification', { detail: stats }));
  }
}

