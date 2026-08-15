import { GlobalFileRow } from './types';
import { collection, doc, setDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

const PROJECT_ID = 'default';

export type DataSourceType = 'Firebase' | 'Cloudflare D1' | 'Cache Local' | 'Chargement...';

let activeDataSource: DataSourceType = 'Chargement...';

export const getActiveDataSource = (): DataSourceType => activeDataSource;

export const setDataSource = (source: DataSourceType) => {
  activeDataSource = source;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('data-source-changed', { detail: source }));
  }
};

let sessionQuotaExceeded = false;

export const resetQuotaOverride = () => {
  sessionQuotaExceeded = false;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('force_d1_active');
  }
};

// Check if forced Cloudflare D1 activation is set to true
const isForceD1Active = (): boolean => {
  return sessionQuotaExceeded || (typeof window !== 'undefined' && localStorage.getItem('force_d1_active') === 'true');
};

const checkAndNotifyQuotaError = (e: unknown) => {
  const errMsg = e instanceof Error ? e.message : String(e);
  if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota exceeded') || errMsg.includes('quota') || errMsg.includes('Quota limit exceeded')) {
    sessionQuotaExceeded = true;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
    }
  }
};

// Helper to save to Cloudflare D1
const saveToD1 = async (data: GlobalFileRow[]) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('cached_global_files', JSON.stringify(data));
    } catch {
      // Large dataset (>5MB) exceeds browser localStorage quota; safely ignored as data is persisted in Cloudflare D1 / Firebase
    }
  }
  try {
    const response = await fetch('/api/d1/global-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      console.warn('Could not save to Cloudflare D1 via API');
    } else {
      console.log('Successfully saved to Cloudflare D1');
    }
  } catch (err) {
    console.error('Failed to sync to Cloudflare D1:', err);
  }
};

export const saveToFirebase = async (data: GlobalFileRow[], append: boolean = false) => {
  let finalData = data;
  if (append) {
    let existing: GlobalFileRow[] = [];
    try {
      existing = await fetchFromFirebase();
    } catch (err) {
      console.warn('Failed to fetch existing data during append, will try to append to D1 instead...', err);
    }
    const appended = [...existing];
    
    data.forEach(row => {
      const idx = appended.findIndex(r => {
        if (row["N° SWO"] && r["N° SWO"] && String(row["N° SWO"]).trim() !== "" && String(row["N° SWO"]).trim() === String(r["N° SWO"]).trim()) {
          return true;
        }
        if (row["PM number"] && r["PM number"] && String(row["PM number"]).trim() !== "" && String(row["PM number"]).trim() === String(r["PM number"]).trim()) {
          return true;
        }
        return false;
      });

      if (idx !== -1) {
        appended[idx] = row;
      } else {
        appended.push(row);
      }
    });

    const uniqueRows: GlobalFileRow[] = [];
    const seenSWOs = new Set<string>();
    const seenPMs = new Set<string>();

    appended.forEach(row => {
      const swo = row["N° SWO"] ? String(row["N° SWO"]).trim() : "";
      const pm = row["PM number"] ? String(row["PM number"]).trim() : "";

      let isDuplicate = false;
      if (swo !== "" && seenSWOs.has(swo)) isDuplicate = true;
      if (pm !== "" && seenPMs.has(pm)) isDuplicate = true;

      if (!isDuplicate) {
        if (swo !== "") seenSWOs.add(swo);
        if (pm !== "") seenPMs.add(pm);
        uniqueRows.push(row);
      } else {
        const existingIdx = uniqueRows.findIndex(r => {
          if (swo !== "" && r["N° SWO"] && String(r["N° SWO"]).trim() === swo) return true;
          if (pm !== "" && r["PM number"] && String(r["PM number"]).trim() === pm) return true;
          return false;
        });
        if (existingIdx !== -1) {
          uniqueRows[existingIdx] = row;
        } else {
          uniqueRows.push(row);
        }
      }
    });
    finalData = uniqueRows;
  } else {
    const uniqueRows: GlobalFileRow[] = [];
    const seenSWOs = new Set<string>();
    const seenPMs = new Set<string>();

    data.forEach(row => {
      const swo = row["N° SWO"] ? String(row["N° SWO"]).trim() : "";
      const pm = row["PM number"] ? String(row["PM number"]).trim() : "";

      let isDuplicate = false;
      if (swo !== "" && seenSWOs.has(swo)) isDuplicate = true;
      if (pm !== "" && seenPMs.has(pm)) isDuplicate = true;

      if (!isDuplicate) {
        if (swo !== "") seenSWOs.add(swo);
        if (pm !== "") seenPMs.add(pm);
        uniqueRows.push(row);
      } else {
        const existingIdx = uniqueRows.findIndex(r => {
          if (swo !== "" && r["N° SWO"] && String(r["N° SWO"]).trim() === swo) return true;
          if (pm !== "" && r["PM number"] && String(r["PM number"]).trim() === pm) return true;
          return false;
        });
        if (existingIdx !== -1) {
          uniqueRows[existingIdx] = row;
        } else {
          uniqueRows.push(row);
        }
      }
    });
    finalData = uniqueRows;
  }

  // If forced Cloudflare D1 mode is active, completely skip Firebase
  if (isForceD1Active()) {
    console.log('Forced Cloudflare D1 active - bypassing Firebase write');
    await saveToD1(finalData);
    setDataSource('Cloudflare D1');
    return;
  }

  // 1. Try to save to Firebase, but capture any errors (e.g., quota exceeded) and proceed
  try {
    const batch = writeBatch(db);
    finalData.forEach(row => {
      const id = row["N° SWO"] || row["PM number"] || ('row-' + Math.random().toString(36).substring(2, 9));
      const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
      const docRef = doc(db, 'projects', PROJECT_ID, 'swo_data', safeId);
      
      const sanitizedRow = JSON.parse(JSON.stringify(row));
      batch.set(docRef, { ...sanitizedRow, project_id: PROJECT_ID, updatedAt: Date.now() }, { merge: true });
    });
    await batch.commit();
    console.log('Successfully synced data to Firebase');
    setDataSource('Firebase');
  } catch (e) {
    console.error('Failed to sync data to Firebase, but falling back to Cloudflare D1:', e);
    checkAndNotifyQuotaError(e);
    setDataSource('Cloudflare D1');
  }

  // 2. Always save to Cloudflare D1
  await saveToD1(finalData);
};

interface LocalComment {
  site_id: string;
  category: string;
  comment: string;
  updated_at?: number;
}

export const saveCommentToFirebase = async (siteId: string, category: string, comment: string) => {
  // Save to local storage as fallback first
  try {
    const localCommentsStr = localStorage.getItem('local_comments') || '[]';
    const localComments = JSON.parse(localCommentsStr) as LocalComment[];
    const existingIndex = localComments.findIndex((c: LocalComment) => c.site_id === siteId && c.category === category);
    if (existingIndex > -1) {
      localComments[existingIndex] = { site_id: siteId, category, comment, updated_at: Date.now() };
    } else {
      localComments.push({ site_id: siteId, category, comment, updated_at: Date.now() });
    }
    localStorage.setItem('local_comments', JSON.stringify(localComments));
  } catch (err) {
    console.error('Failed to save comment to localStorage', err);
  }

  // If forced D1 is active, skip Firebase write entirely
  if (isForceD1Active()) {
    console.log('Forced Cloudflare D1 active - bypassing Firebase write for comment');
    try {
      const response = await fetch('/api/d1/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId, category, comment })
      });
      if (!response.ok) {
        console.warn('Failed to save comment to Cloudflare D1 API');
      }
    } catch (err) {
      console.error('Failed to save comment to Cloudflare D1:', err);
    }
    return;
  }

  // Try saving to Firebase
  try {
    const safeId = `${siteId}_${category}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    await setDoc(doc(db, 'projects', PROJECT_ID, 'manual_comments', safeId), {
      site_id: siteId,
      category,
      comment,
      updated_at: Date.now()
    }, { merge: true });
  } catch(e) {
    console.error('Failed to save comment to Firebase:', e);
    checkAndNotifyQuotaError(e);
  }

  // Try saving to Cloudflare D1 always
  try {
    const response = await fetch('/api/d1/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: siteId, category, comment })
    });
    if (!response.ok) {
      console.warn('Failed to save comment to Cloudflare D1 API');
    }
  } catch (err) {
    console.error('Failed to save comment to Cloudflare D1:', err);
  }
};

export const fetchCommentsFromFirebase = async (): Promise<{site_id: string, category: string, comment: string}[]> => {
  if (isForceD1Active()) {
    console.log('Forced Cloudflare D1 active - fetching comments from Cloudflare D1');
    try {
      const response = await fetch('/api/d1/comments');
      if (response.ok) {
        const d1Data = await response.json();
        if (d1Data && d1Data.success && Array.isArray(d1Data.comments)) {
          console.log(`Loaded comments from Cloudflare D1 (count: ${d1Data.comments.length})`);
          return d1Data.comments;
        }
      }
    } catch (d1Err) {
      console.error('Cloudflare D1 comments fallback failed:', d1Err);
    }
    // local fallback
    try {
      const localCommentsStr = localStorage.getItem('local_comments') || '[]';
      return JSON.parse(localCommentsStr);
    } catch {
      return [];
    }
  }

  try {
    const querySnapshot = await getDocs(collection(db, 'projects', PROJECT_ID, 'manual_comments'));
    const comments: {site_id: string, category: string, comment: string}[] = [];
    querySnapshot.forEach((doc) => {
      comments.push(doc.data() as {site_id: string, category: string, comment: string});
    });
    
    // Silently update Cloudflare D1 in background if Firebase was successful
    if (comments.length > 0) {
      comments.forEach(async (c) => {
        try {
          fetch('/api/d1/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ site_id: c.site_id, category: c.category, comment: c.comment })
          });
        } catch {
          // silent error catch
        }
      });
    }

    return comments;
  } catch (e) {
    console.error('Error fetching comments from Firebase, falling back to Cloudflare D1 or local storage:', e);
    checkAndNotifyQuotaError(e);
    
    // Fallback 1: Cloudflare D1
    try {
      const response = await fetch('/api/d1/comments');
      if (response.ok) {
        const d1Data = await response.json();
        if (d1Data && d1Data.success && Array.isArray(d1Data.comments)) {
          console.log(`Successfully loaded comments from Cloudflare D1 fallback (count: ${d1Data.comments.length})`);
          return d1Data.comments;
        }
      }
    } catch (d1Err) {
      console.error('Cloudflare D1 comments fallback failed:', d1Err);
    }

    // Fallback 2: Local storage
    try {
      const localCommentsStr = localStorage.getItem('local_comments') || '[]';
      return JSON.parse(localCommentsStr);
    } catch (localErr) {
      console.error('Local comments parsing failed:', localErr);
      return [];
    }
  }
};

export const fetchFromFirebase = async (): Promise<GlobalFileRow[]> => {
  const getLocalCache = (): GlobalFileRow[] => {
    if (typeof window === 'undefined') return [];
    try {
      const str = localStorage.getItem('cached_global_files');
      if (str) {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [];
  };

  if (isForceD1Active()) {
    console.log('Forced Cloudflare D1 active - fetching from Cloudflare D1 directly');
    try {
      const response = await fetch('/api/d1/global-files');
      if (response.ok) {
        const d1Data = await response.json();
        if (d1Data && d1Data.success && Array.isArray(d1Data.rows) && d1Data.rows.length > 0) {
          if (typeof window !== 'undefined') {
            try { localStorage.setItem('cached_global_files', JSON.stringify(d1Data.rows)); } catch {}
          }
          setDataSource('Cloudflare D1');
          return d1Data.rows;
        }
      }
    } catch (d1Err) {
      console.error('Cloudflare D1 fetch failed:', d1Err);
    }

    // Fallback 1: LocalStorage Cache
    const localCache = getLocalCache();
    if (localCache.length > 0) {
      console.log(`Loaded ${localCache.length} rows from localStorage cache.`);
      setDataSource('Cache Local');
      return localCache;
    }

    // Fallback 2: Try fetching PM data and converting to GlobalFileRow
    try {
      const pmRows = await fetchPMFromFirebase();
      if (Array.isArray(pmRows) && pmRows.length > 0) {
        setDataSource('Cloudflare D1');
        const mapped: GlobalFileRow[] = pmRows.map(r => ({
          "ID": (r.site_code || r.id || '') as string,
          "PM number": (r.pm_number || '') as string,
          "Nom du site": (r.site_name || '') as string,
          "Region": (r.region || '') as string,
          "PM Date": (r.planned_date || '') as string,
          "Types de PM": (r.maintenance_type || '') as string,
          "FE names": (r.technician_name || '') as string,
          "PM date execute": (r.executed_date || '') as string,
          "PM date replanifiée": (r.reprogrammed_date || '') as string,
          "status": (r.status || 'Planifié') as string,
          "comments": (r.comments || '') as string
        }));
        return mapped;
      }
    } catch { /* ignore */ }

    setDataSource('Cloudflare D1');
    return [];
  }

  // Standard Firebase mode with fallbacks
  try {
    const querySnapshot = await getDocs(collection(db, 'projects', PROJECT_ID, 'swo_data'));
    const rows: GlobalFileRow[] = [];
    querySnapshot.forEach((doc) => {
      rows.push(doc.data() as GlobalFileRow);
    });
    
    if (rows.length > 0) {
      setDataSource('Firebase');
      saveToD1(rows).catch(err => console.error('Silent background D1 sync failed:', err));
      return rows;
    }
  } catch (e) {
    console.warn('Failed to fetch from Firebase API, attempting Cloudflare D1 / Local Cache fallback...', e);
    checkAndNotifyQuotaError(e);
  }

  // Fallback A: Cloudflare D1 API
  try {
    const response = await fetch('/api/d1/global-files');
    if (response.ok) {
      const d1Data = await response.json();
      if (d1Data && d1Data.success && Array.isArray(d1Data.rows) && d1Data.rows.length > 0) {
        console.log(`Successfully loaded data from Cloudflare D1 fallback (count: ${d1Data.rows.length})`);
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('cached_global_files', JSON.stringify(d1Data.rows)); } catch {}
        }
        setDataSource('Cloudflare D1');
        return d1Data.rows;
      }
    }
  } catch (d1Err) {
    console.error('Cloudflare D1 fallback failed as well:', d1Err);
  }

  // Fallback B: LocalStorage Cache
  const localCache = getLocalCache();
  if (localCache.length > 0) {
    console.log(`Loaded ${localCache.length} rows from localStorage cache.`);
    setDataSource('Cache Local');
    return localCache;
  }

  // Fallback C: PM Assignments fallback
  try {
    const pmRows = await fetchPMFromFirebase();
    if (Array.isArray(pmRows) && pmRows.length > 0) {
      setDataSource('Cloudflare D1');
      return pmRows.map(r => ({
        "ID": (r.site_code || r.id || '') as string,
        "PM number": (r.pm_number || '') as string,
        "Nom du site": (r.site_name || '') as string,
        "Region": (r.region || '') as string,
        "PM Date": (r.planned_date || '') as string,
        "Types de PM": (r.maintenance_type || '') as string,
        "FE names": (r.technician_name || '') as string,
        "PM date execute": (r.executed_date || '') as string,
        "PM date replanifiée": (r.reprogrammed_date || '') as string,
        "status": (r.status || 'Planifié') as string,
        "comments": (r.comments || '') as string
      }));
    }
  } catch {}

  setDataSource('Firebase');
  return [];
};

export const fetchPMFromFirebase = async (): Promise<Record<string, unknown>[]> => {
  if (isForceD1Active()) {
    console.log('Forced Cloudflare D1 active - fetching PM from Cloudflare D1 directly');
    try {
      const response = await fetch('/api/d1/pm');
      if (response.ok) {
        const d1Data = await response.json();
        if (d1Data && d1Data.success && Array.isArray(d1Data.rows)) {
          return d1Data.rows;
        }
      }
    } catch (d1Err) {
      console.error('Cloudflare D1 PM fetch failed:', d1Err);
    }
    return [];
  }

  try {
    const querySnapshot = await getDocs(collection(db, 'projects', PROJECT_ID, 'pm_assignments'));
    const rows: Record<string, unknown>[] = [];
    querySnapshot.forEach((doc) => {
      rows.push(doc.data());
    });
    return rows;
  } catch (e) {
    console.warn('Failed to fetch PM from Firebase API, attempting D1 fallback...', e);
    checkAndNotifyQuotaError(e);
    try {
      const response = await fetch('/api/d1/pm');
      if (response.ok) {
        const d1Data = await response.json();
        if (d1Data && d1Data.success && Array.isArray(d1Data.rows)) {
          console.log('Successfully loaded PM assignments from Cloudflare D1');
          return d1Data.rows;
        }
      }
    } catch (d1Err) {
      console.error('PM fallback failed:', d1Err);
    }
    return [];
  }
};

export const syncPMToFirebase = async (payloads: Record<string, unknown>[]): Promise<{success: number, fail: number}> => {
  let successCount = 0;
  let failCount = 0;
  
  if (isForceD1Active()) {
    console.log('Forced Cloudflare D1 active - bypassing Firebase PM write');
    try {
      const d1Payloads = payloads.map(payload => {
        const pmNum = payload.pm_number || ('pm-' + Math.random().toString(36).substring(2, 9));
        const id = payload.id || ('pm-' + Math.random().toString(36).substring(2, 9));
        return {
          id,
          site_code: payload.site_code || payload.ID || '',
          pm_number: pmNum,
          site_name: payload.site_name || payload["Nom du site"] || '',
          region: payload.region || payload["Region"] || '',
          planned_date: payload.planned_date || payload["PM Date"] || '',
          maintenance_type: payload.maintenance_type || payload["Types de PM"] || '',
          technician_name: payload.technician_name || payload["FE names"] || '',
          executed_date: payload.executed_date || payload["PM date execute"] || '',
          reprogrammed_date: payload.reprogrammed_date || payload["PM date replanifiée"] || '',
          status: payload.status || 'Planifié',
          comments: payload.comments || payload["comments"] || ''
        };
      });

      const response = await fetch('/api/d1/sync-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d1Payloads)
      });

      if (response.ok) {
        successCount = payloads.length;
      } else {
        failCount = payloads.length;
      }
    } catch (d1Err) {
      console.error('D1 sync error:', d1Err);
      failCount = payloads.length;
    }
    return { success: successCount, fail: failCount };
  }

  // Try Firebase write
  try {
    const batch = writeBatch(db);
    payloads.forEach(payload => {
      const pmNum = payload.pm_number || ('pm-' + Math.random().toString(36).substring(2, 9));
      const safeId = String(pmNum).replace(/[^a-zA-Z0-9_-]/g, '_');
      
      const docRef1 = doc(db, 'projects', PROJECT_ID, 'pm_assignments', safeId);
      batch.set(docRef1, { ...payload, updated_at: Date.now() }, { merge: true });

      const docRef2 = doc(db, 'projects', PROJECT_ID, 'daily_raw_data', safeId);
      batch.set(docRef2, { ...payload, imported_at: Date.now() }, { merge: true });
    });
    await batch.commit();
    successCount = payloads.length;
    console.log('Successfully saved PM assignments to Firebase');
  } catch (e) {
    console.error('Firebase Batch commit failed, using Cloudflare D1 fallback:', e);
    checkAndNotifyQuotaError(e);
  }

  // Always sync to D1 as well
  try {
    const d1Payloads = payloads.map(payload => {
      const pmNum = payload.pm_number || ('pm-' + Math.random().toString(36).substring(2, 9));
      const id = payload.id || ('pm-' + Math.random().toString(36).substring(2, 9));
      return {
        id,
        site_code: payload.site_code || payload.ID || '',
        pm_number: pmNum,
        site_name: payload.site_name || payload["Nom du site"] || '',
        region: payload.region || payload["Region"] || '',
        planned_date: payload.planned_date || payload["PM Date"] || '',
        maintenance_type: payload.maintenance_type || payload["Types de PM"] || '',
        technician_name: payload.technician_name || payload["FE names"] || '',
        executed_date: payload.executed_date || payload["PM date execute"] || '',
        reprogrammed_date: payload.reprogrammed_date || payload["PM date replanifiée"] || '',
        status: payload.status || 'Planifié',
        comments: payload.comments || payload["comments"] || ''
      };
    });

    const response = await fetch('/api/d1/sync-daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d1Payloads)
    });

    if (response.ok) {
      console.log('Successfully saved PM assignments to Cloudflare D1');
      if (successCount === 0) {
        successCount = payloads.length;
      }
    } else {
      console.warn('D1 sync-daily API call failed');
      if (successCount === 0) {
        failCount = payloads.length;
      }
    }
  } catch (d1Err) {
    console.error('D1 sync error:', d1Err);
    if (successCount === 0) {
      failCount = payloads.length;
    }
  }

  return { success: successCount, fail: failCount };
};

export const clearFirebaseData = async () => {
  if (isForceD1Active()) {
    console.log('Forced Cloudflare D1 active - clearing only Cloudflare D1 data');
    try {
      await fetch('/api/d1/global-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([])
      });
    } catch (e) {
      console.error('Failed to clear D1 database:', e);
    }
    return;
  }

  try {
    const querySnapshot = await getDocs(collection(db, 'projects', PROJECT_ID, 'swo_data'));
    const batch = writeBatch(db);
    querySnapshot.forEach((d) => {
      batch.delete(doc(db, 'projects', PROJECT_ID, 'swo_data', d.id));
    });
    await batch.commit();
  } catch(e) {
    console.error(e);
    checkAndNotifyQuotaError(e);
  }

  // Clear Cloudflare D1 as well
  try {
    await fetch('/api/d1/global-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([])
    });
  } catch (e) {
    console.error('Failed to clear D1 database:', e);
  }
};
