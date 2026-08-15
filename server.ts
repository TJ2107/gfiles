/* eslint-disable @typescript-eslint/no-explicit-any */
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Setup local mock D1 SQL Database JSON file to avoid API crashes in dev server
const mockDbFile = path.join(__dirname, 'd1_mock_db.json');
function readMockDb() {
  if (!fs.existsSync(mockDbFile)) {
    const initial = {
      users: [
        {
          uid: 'admin-id',
          email: 'cyber.kan587@gmail.com',
          display_name: 'Administrateur',
          role: 'Admin',
          password: 'admin'
        }
      ],
      pm_assignments: [
        {
          id: 'row-01',
          site_code: 'SITE_DK_01',
          pm_number: 'PM-2026-1001',
          site_name: 'Site Dakar Plateau',
          region: 'DAKAR',
          planned_date: '2026-07-23',
          maintenance_type: 'Trimestrielle',
          technician_name: 'Ibrahima Ndiaye',
          executed_date: '2026-07-23',
          reprogrammed_date: '',
          status: 'Exécuté',
          comments: ''
        },
        {
          id: 'row-02',
          site_code: 'SITE_TH_02',
          pm_number: 'PM-2026-1002',
          site_name: 'Site Thiès Gare',
          region: 'THIES',
          planned_date: '2026-07-23',
          maintenance_type: 'Semestrielle',
          technician_name: 'Moustapha Diop',
          executed_date: '',
          reprogrammed_date: '',
          status: 'Planifié',
          comments: ''
        },
        {
          id: 'row-03',
          site_code: 'SITE_SL_03',
          pm_number: 'PM-2026-1003',
          site_name: 'Site Saint-Louis Nord',
          region: 'SAINT-LOUIS',
          planned_date: '2026-07-23',
          maintenance_type: 'Annuelle',
          technician_name: 'Amadou Sow',
          executed_date: '',
          reprogrammed_date: '2026-07-25',
          status: 'Replanifié',
          comments: ''
        },
        {
          id: 'row-04',
          site_code: 'SITE_ZG_04',
          pm_number: 'PM-2026-1004',
          site_name: 'Site Ziguinchor Centre',
          region: 'ZIGUINCHOR',
          planned_date: '2026-07-23',
          maintenance_type: 'Mensuelle',
          technician_name: 'Fatou Fall',
          executed_date: '',
          reprogrammed_date: '',
          status: 'En retard',
          comments: ''
        }
      ]
    };
    fs.writeFileSync(mockDbFile, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(mockDbFile, 'utf-8'));
  } catch {
    return { users: [], pm_assignments: [] };
  }
}

function writeMockDb(data: any) {
  fs.writeFileSync(mockDbFile, JSON.stringify(data, null, 2), 'utf-8');
}

// Setup file logging to debug crashes
const logFile = path.join(__dirname, 'server-debug.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => {
  const msg = new Date().toISOString() + ' LOG: ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n';
  logStream.write(msg);
  originalLog(...args);
};
console.error = (...args) => {
  const msg = new Date().toISOString() + ' ERR: ' + args.map(a => typeof a === 'object' ? (a.stack || JSON.stringify(a)) : a).join(' ') + '\n';
  logStream.write(msg);
  originalError(...args);
};

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

console.log('Server starting, log file at:', logFile);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const url = req.originalUrl || '';
      // Only log API requests or actual errors to keep console logs focused
      // and avoid false positive scanner matches on filenames like ErrorBoundary.tsx
      if (url.startsWith('/api') || res.statusCode >= 400) {
        console.log(`${req.method} ${url} - ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });
  app.use(express.json({ limit: '500mb' }));
  app.use(express.urlencoded({ limit: '500mb', extended: true }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'Firebase/D1 Local' });
  });

  // A. GET /api/auth/users (Fetch all registered users)
  app.get('/api/auth/users', (req, res) => {
    try {
      const db = readMockDb();
      const users = db.users.map((u: any) => ({
        uid: u.uid,
        email: u.email,
        displayName: u.display_name,
        role: u.role
      }));
      res.json({ success: true, users });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // B. POST /api/auth/login (Verify login against database)
  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      const db = readMockDb();
      const user = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        return res.status(404).json({ error: "Utilisateur non trouvé dans la base de données locale." });
      }
      if (user.password !== password) {
        return res.status(401).json({ error: "Mot de passe incorrect." });
      }
      res.json({
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.display_name,
          role: user.role
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // C. POST /api/auth/register (Create new user in database)
  app.post('/api/auth/register', (req, res) => {
    try {
      const { email, password, displayName, role } = req.body;
      const db = readMockDb();
      const existing = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        return res.status(400).json({ error: "Cet email est déjà utilisé." });
      }
      const uid = 'user-' + Math.random().toString(36).substring(2, 11);
      const newUser = {
        uid,
        email,
        display_name: displayName,
        role: role || 'User',
        password
      };
      db.users.push(newUser);
      writeMockDb(db);
      res.json({
        success: true,
        user: {
          uid,
          email,
          displayName,
          role: role || 'User'
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // D. GET /api/d1/pm (Retrieve custom assignments/overrides from D1)
  app.get('/api/d1/pm', (req, res) => {
    try {
      const db = readMockDb();
      const results = db.pm_assignments;
      const mappedRows = results.map((row: any) => ({
        id: row.id,
        "ID": row.site_code || row.id,
        "PM number": row.pm_number,
        "Nom du site": row.site_name,
        "Region": row.region,
        "PM Date": row.planned_date,
        "Types de PM": row.maintenance_type,
        "FE names": row.technician_name,
        "PM date execute": row.executed_date || '',
        "PM date replanifiée": row.reprogrammed_date || '',
        "status": row.status,
        "comments": row.comments || ''
      }));
      res.json({ success: true, rows: mappedRows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // E. POST /api/d1/pm (Create/Update custom assignments or reschedule logs in D1)
  app.post('/api/d1/pm', (req, res) => {
    try {
      const { id, site_code, pm_number, site_name, region, planned_date, maintenance_type, technician_name, executed_date, reprogrammed_date, status, comments } = req.body;
      const db = readMockDb();
      
      const existingIndex = db.pm_assignments.findIndex((p: any) => p.pm_number === pm_number);
      if (existingIndex > -1) {
        db.pm_assignments[existingIndex] = {
          ...db.pm_assignments[existingIndex],
          site_code: site_code || db.pm_assignments[existingIndex].site_code,
          site_name: site_name || db.pm_assignments[existingIndex].site_name,
          region: region || db.pm_assignments[existingIndex].region,
          planned_date: planned_date || db.pm_assignments[existingIndex].planned_date,
          maintenance_type: maintenance_type || db.pm_assignments[existingIndex].maintenance_type,
          technician_name: technician_name || db.pm_assignments[existingIndex].technician_name,
          executed_date: executed_date !== undefined ? executed_date : db.pm_assignments[existingIndex].executed_date,
          reprogrammed_date: reprogrammed_date !== undefined ? reprogrammed_date : db.pm_assignments[existingIndex].reprogrammed_date,
          status: status || db.pm_assignments[existingIndex].status,
          comments: comments !== undefined ? comments : db.pm_assignments[existingIndex].comments
        };
      } else {
        db.pm_assignments.push({
          id: id || 'pm-' + Math.random().toString(36).substring(2, 9),
          site_code,
          pm_number,
          site_name,
          region,
          planned_date,
          maintenance_type,
          technician_name,
          executed_date: executed_date || '',
          reprogrammed_date: reprogrammed_date || '',
          status: status || 'Planifié',
          comments: comments || ''
        });
      }
      
      writeMockDb(db);
      res.json({ success: true, message: "Planning PM mis à jour avec succès." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // F. POST /api/d1/sync-daily (Create/Update daily raw data)
  app.post('/api/d1/sync-daily', (req, res) => {
    try {
      const db = readMockDb();
      if (!db.daily_raw_data) {
        db.daily_raw_data = [];
      }

      const items = Array.isArray(req.body) ? req.body : [req.body];

      for (const item of items) {
        const { id, site_code, pm_number, site_name, region, planned_date, maintenance_type, technician_name, executed_date, reprogrammed_date, status, comments } = item;
        
        const existingIndex = db.daily_raw_data.findIndex((p: any) => p.pm_number === pm_number);
        if (existingIndex > -1) {
          db.daily_raw_data[existingIndex] = {
            ...db.daily_raw_data[existingIndex],
            site_code: site_code || db.daily_raw_data[existingIndex].site_code,
            site_name: site_name || db.daily_raw_data[existingIndex].site_name,
            region: region || db.daily_raw_data[existingIndex].region,
            planned_date: planned_date || db.daily_raw_data[existingIndex].planned_date,
            maintenance_type: maintenance_type || db.daily_raw_data[existingIndex].maintenance_type,
            technician_name: technician_name || db.daily_raw_data[existingIndex].technician_name,
            executed_date: executed_date !== undefined ? executed_date : db.daily_raw_data[existingIndex].executed_date,
            reprogrammed_date: reprogrammed_date !== undefined ? reprogrammed_date : db.daily_raw_data[existingIndex].reprogrammed_date,
            status: status || db.daily_raw_data[existingIndex].status,
            comments: comments !== undefined ? comments : db.daily_raw_data[existingIndex].comments,
            imported_at: new Date().toISOString()
          };
        } else {
          db.daily_raw_data.push({
            id: id || 'raw-' + Math.random().toString(36).substring(2, 9),
            site_code,
            pm_number,
            site_name,
            region,
            planned_date,
            maintenance_type,
            technician_name,
            executed_date: executed_date || '',
            reprogrammed_date: reprogrammed_date || '',
            status: status || 'Planifié',
            comments: comments || '',
            imported_at: new Date().toISOString()
          });
        }
      }
      
      writeMockDb(db);
      res.json({ success: true, message: "Données brutes journalières synchronisées avec succès." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // G. GET /api/d1/sync-daily (Retrieve custom assignments/overrides from D1)
  app.get('/api/d1/sync-daily', (req, res) => {
    try {
      const db = readMockDb();
      const results = db.daily_raw_data || [];
      const mappedRows = results.map((row: any) => ({
        id: row.id,
        "ID": row.site_code || row.id,
        "PM number": row.pm_number,
        "Nom du site": row.site_name,
        "Region": row.region,
        "PM Date": row.planned_date,
        "Types de PM": row.maintenance_type,
        "FE names": row.technician_name,
        "PM date execute": row.executed_date || '',
        "PM date replanifiée": row.reprogrammed_date || '',
        "status": row.status,
        "comments": row.comments || ''
      }));
      res.json({ success: true, rows: mappedRows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // H. GET /api/d1/global-files
  app.get('/api/d1/global-files', (req, res) => {
    try {
      const db = readMockDb();
      let results = db.global_files || [];
      
      if (results.length === 0 && db.pm_assignments && db.pm_assignments.length > 0) {
        results = db.pm_assignments.map((row: any) => ({
          id: row.id,
          swo_number: row.site_code || row.id,
          pm_number: row.pm_number,
          raw_json: JSON.stringify({
            "ID": row.site_code || row.id,
            "PM number": row.pm_number,
            "Nom du site": row.site_name,
            "Region": row.region,
            "PM Date": row.planned_date,
            "Types de PM": row.maintenance_type,
            "FE names": row.technician_name,
            "PM date execute": row.executed_date || '',
            "PM date replanifiée": row.reprogrammed_date || '',
            "status": row.status,
            "comments": row.comments || ''
          }),
          updated_at: new Date().toISOString()
        }));
      }

      const rows = results.map((r: any) => {
        try { return JSON.parse(r.raw_json); } catch { return null; }
      }).filter((r: any) => r !== null);
      res.json({ success: true, rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // I. POST /api/d1/global-files
  app.post('/api/d1/global-files', (req, res) => {
    try {
      const items = Array.isArray(req.body) ? req.body : [req.body];
      const db = readMockDb();
      
      db.global_files = items.map((item: any) => ({
        id: 'row-' + Math.random().toString(36).substring(2, 9),
        swo_number: item["N° SWO"] || '',
        pm_number: item["PM number"] || '',
        raw_json: JSON.stringify(item),
        updated_at: new Date().toISOString()
      }));
      
      writeMockDb(db);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // J. GET /api/d1/comments (Retrieve comments from mock database)
  app.get('/api/d1/comments', (req, res) => {
    try {
      const db = readMockDb();
      const comments = db.manual_comments || [];
      res.json({ success: true, comments });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // K. POST /api/d1/comments (Create/Update manual comment in mock database)
  app.post('/api/d1/comments', (req, res) => {
    try {
      const { site_id, category, comment } = req.body;
      const db = readMockDb();
      if (!db.manual_comments) {
        db.manual_comments = [];
      }
      const existingIdx = db.manual_comments.findIndex((c: any) => c.site_id === site_id && c.category === category);
      if (existingIdx > -1) {
        db.manual_comments[existingIdx] = {
          site_id,
          category,
          comment,
          updated_at: Date.now()
        };
      } else {
        db.manual_comments.push({
          site_id,
          category,
          comment,
          updated_at: Date.now()
        });
      }
      writeMockDb(db);
      res.json({ success: true, message: "Commentaire enregistré localement dans mock D1." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/retable/workspaces', async (req, res) => {
    try {
      const apiKey = (req.headers['x-api-key'] as string) || process.env.RETABLE_API_KEY || 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM';
      
      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM') {
        console.log('Using default key - returning STHIC Workspace');
        return res.json({
          isSthicLive: true,
          data: {
            workspaces: [
              { id: 'ws-sthic-live', name: 'STHIC Production' }
            ]
          }
        });
      }

      const response = await fetch('https://api.retable.io/v1/public/workspaces', {
        headers: { 'ApiKey': apiKey }
      });
      if (!response.ok) {
        throw new Error(`Retable API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching workspaces, using demo fallback:', error);
      res.json({
        isDemo: true,
        data: {
          workspaces: [
            { id: 'ws-demo-01', name: 'Espace Démo - Suivi PM Retable (Fallback)' }
          ]
        }
      });
    }
  });

  app.get('/api/retable/projects', async (req, res) => {
    try {
      const apiKey = (req.headers['x-api-key'] as string) || process.env.RETABLE_API_KEY || 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM';
      const { workspaceId } = req.query;

      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' || workspaceId === 'ws-sthic-live') {
        return res.json({
          isSthicLive: true,
          data: {
            projects: [
              { id: 'proj-sthic-live', name: 'Suivi PM & Maintenances' }
            ]
          }
        });
      }

      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' || workspaceId === 'ws-demo-01') {
        return res.json({
          isDemo: true,
          data: {
            projects: [
              { id: 'proj-demo-01', name: 'Projet Maintenance Télécom 2026' }
            ]
          }
        });
      }

      if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId is required' });
      }
      const response = await fetch(`https://api.retable.io/v1/public/workspaces/${workspaceId}/projects`, {
        headers: { 'ApiKey': apiKey }
      });
      if (!response.ok) {
        throw new Error(`Retable API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching projects, using demo fallback:', error);
      res.json({
        isDemo: true,
        data: {
          projects: [
            { id: 'proj-demo-01', name: 'Projet Maintenance Télécom 2026 (Fallback)' }
          ]
        }
      });
    }
  });

  app.get('/api/retable/tables', async (req, res) => {
    try {
      const apiKey = (req.headers['x-api-key'] as string) || process.env.RETABLE_API_KEY || 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM';
      const { projectId } = req.query;

      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' || projectId === 'proj-sthic-live') {
        return res.json({
          isSthicLive: true,
          data: {
            tables: [
              { id: 'tab-sthic-live', title: 'Planification PM (STHIC Live)' }
            ]
          }
        });
      }

      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' || projectId === 'proj-demo-01') {
        return res.json({
          isDemo: true,
          data: {
            tables: [
              { id: 'tab-demo-01', title: 'Suivi PM Sénégal Global' }
            ]
          }
        });
      }

      if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
      }
      const response = await fetch(`https://api.retable.io/v1/public/projects/${projectId}/tables`, {
        headers: { 'ApiKey': apiKey }
      });
      if (!response.ok) {
        throw new Error(`Retable API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Error fetching tables, using demo fallback:', error);
      res.json({
        isDemo: true,
        data: {
          tables: [
            { id: 'tab-demo-01', title: 'Suivi PM Sénégal Global (Fallback)' }
          ]
        }
      });
    }
  });

  app.get('/api/retable/data', async (req, res) => {
    try {
      const apiKey = (req.headers['x-api-key'] as string) || process.env.RETABLE_API_KEY || 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM';
      const { retableId } = req.query;

      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' || retableId === 'tab-sthic-live') {
        console.log('Fetching live PM data from sthic-maintenances-generateurs.pages.dev');
        
        // 1. Fetch PM assignments
        const assignmentsRes = await fetch('https://sthic-maintenances-generateurs.pages.dev/api/pm-assignments', {
          headers: { 'x-api-key': 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' }
        });
        if (!assignmentsRes.ok) {
          throw new Error(`Failed to fetch assignments from STHIC API: ${assignmentsRes.status}`);
        }
        const assignmentsJson = await assignmentsRes.json();
        const assignments = assignmentsJson.assignments || [];

        // 2. Fetch Sites to map Site Name
        const sitesMap = new Map();
        try {
          const sitesRes = await fetch('https://sthic-maintenances-generateurs.pages.dev/api/sites', {
            headers: { 'x-api-key': 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' }
          });
          if (sitesRes.ok) {
            const sitesJson = await sitesRes.json();
            const sitesList = sitesJson.sites || [];
            sitesList.forEach((site: any) => {
              if (site.id) {
                sitesMap.set(String(site.id), site.nameSite || site.idSite || '');
              }
            });
          }
        } catch (siteErr) {
          console.error("Error fetching sites map:", siteErr);
        }

        // 3. Map to standard flat PM lines compatible with normalized keys
        const rows = assignments.map((asg: any) => {
          const siteName = sitesMap.get(String(asg.siteId)) || asg.siteCode || 'Site Inconnu';
          
          // Determine status translation
          let statusText = 'Planifié';
          if (asg.pmState === 'Closed Complete' || asg.closedAt) {
            statusText = 'Exécuté';
          } else if (asg.reprogrammationDate) {
            statusText = 'Replanifié';
          } else {
            // Check if plannedDate is in the past
            const pDate = new Date(asg.plannedDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (pDate < today) {
              statusText = 'En retard';
            }
          }

          return {
            id: asg.id,
            "ID": asg.siteCode || asg.siteId,
            "PM number": asg.pmNumber,
            "Nom du site": siteName,
            "Region": asg.zone || '',
            "PM Date": asg.plannedDate || '',
            "Types de PM": asg.maintenanceType || '',
            "FE names": asg.technicianName || '',
            "PM date execute": asg.closedAt || '',
            "PM date replanifiée": asg.reprogrammationDate || '',
            "status": statusText
          };
        });

        console.log(`Successfully mapped ${rows.length} PM assignments from STHIC live API`);
        return res.json({ success: true, isSthicLive: true, rows });
      }

      const demoRows = [
        {
          id: "row-01",
          cell_values: {
            "ID": "SITE_DK_01",
            "PM number": "PM-2026-1001",
            "Nom du site": "Site Dakar Plateau",
            "Region": "DAKAR",
            "PM Date": "2026-07-23",
            "Types de PM": "Trimestrielle",
            "FE names": "Ibrahima Ndiaye",
            "PM date execute": "2026-07-23",
            "PM date replanifiée": "",
            "status": "Exécuté"
          }
        },
        {
          id: "row-02",
          cell_values: {
            "ID": "SITE_TH_02",
            "PM number": "PM-2026-1002",
            "Nom du site": "Site Thiès Gare",
            "Region": "THIES",
            "PM Date": "2026-07-23",
            "Types de PM": "Semestrielle",
            "FE names": "Moustapha Diop",
            "PM date execute": "",
            "PM date replanifiée": "",
            "status": "Planifié"
          }
        },
        {
          id: "row-03",
          cell_values: {
            "ID": "SITE_SL_03",
            "PM number": "PM-2026-1003",
            "Nom du site": "Site Saint-Louis Nord",
            "Region": "SAINT-LOUIS",
            "PM Date": "2026-07-23",
            "Types de PM": "Annuelle",
            "FE names": "Amadou Sow",
            "PM date execute": "",
            "PM date replanifiée": "2026-07-25",
            "status": "Replanifié"
          }
        },
        {
          id: "row-04",
          cell_values: {
            "ID": "SITE_ZG_04",
            "PM number": "PM-2026-1004",
            "Nom du site": "Site Ziguinchor Centre",
            "Region": "ZIGUINCHOR",
            "PM Date": "2026-07-23",
            "Types de PM": "Mensuelle",
            "FE names": "Fatou Fall",
            "PM date execute": "",
            "PM date replanifiée": "",
            "status": "En retard"
          }
        },
        {
          id: "row-05",
          cell_values: {
            "ID": "SITE_KL_05",
            "PM number": "PM-2026-1005",
            "Nom du site": "Site Kaolack Marché",
            "Region": "KAOLACK",
            "PM Date": "2026-07-23",
            "Types de PM": "Trimestrielle",
            "FE names": "Ousmane Cissé",
            "PM date execute": "2026-07-23",
            "PM date replanifiée": "",
            "status": "Exécuté"
          }
        },
        {
          id: "row-06",
          cell_values: {
            "ID": "SITE_DK_06",
            "PM number": "PM-2026-1006",
            "Nom du site": "Site Dakar Almadies",
            "Region": "DAKAR",
            "PM Date": "2026-07-24",
            "Types de PM": "Trimestrielle",
            "FE names": "Ibrahima Ndiaye",
            "PM date execute": "",
            "PM date replanifiée": "",
            "status": "Planifié"
          }
        },
        {
          id: "row-07",
          cell_values: {
            "ID": "SITE_TH_07",
            "PM number": "PM-2026-1007",
            "Nom du site": "Site Thiès Route",
            "Region": "THIES",
            "PM Date": "2026-07-22",
            "Types de PM": "Mensuelle",
            "FE names": "Moustapha Diop",
            "PM date execute": "2026-07-22",
            "PM date replanifiée": "",
            "status": "Exécuté"
          }
        }
      ];

      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' || retableId === 'tab-demo-01') {
        const rows = demoRows.map((row: any) => {
          const flatRow: any = { id: row.id };
          Object.keys(row.cell_values).forEach((key) => {
            flatRow[key] = (row.cell_values as any)[key];
          });
          return flatRow;
        });
        return res.json({ success: true, isDemo: true, rows });
      }

      if (!retableId) {
        return res.status(400).json({ error: 'retableId is required' });
      }
      const apiUrl = `https://api.retable.io/v1/public/retable/${retableId}/data`;
      console.log(`Fetching Retable data from: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        headers: { 'ApiKey': apiKey }
      });
      if (!response.ok) {
        throw new Error(`Retable API error: ${response.status} ${response.statusText}`);
      }
      const json = await response.json();
      
      let rawRows = [];
      if (json && json.data && Array.isArray(json.data.rows)) {
        rawRows = json.data.rows;
      } else if (json && Array.isArray(json.rows)) {
        rawRows = json.rows;
      } else if (Array.isArray(json)) {
        rawRows = json;
      }

      const rows = rawRows.map((row: any) => {
        const flatRow: any = { id: row.row_id || row.id };
        if (Array.isArray(row.columns)) {
          row.columns.forEach((col: any) => {
            if (col && col.name) {
              flatRow[col.name] = col.val;
            }
          });
        } else if (row.cell_values) {
          Object.keys(row.cell_values).forEach((key) => {
            flatRow[key] = row.cell_values[key];
          });
        } else {
          Object.keys(row).forEach((k) => {
            if (k !== 'columns' && k !== 'cell_values') {
              flatRow[k] = row[k];
            }
          });
        }
        return flatRow;
      });

      res.json({ success: true, rows });
    } catch (error: any) {
      console.error('Error fetching table data, using demo fallback:', error);
      const fallbackRows = [
        {
          id: "row-01",
          "ID": "SITE_DK_01",
          "PM number": "PM-2026-1001",
          "Nom du site": "Site Dakar Plateau",
          "Region": "DAKAR",
          "PM Date": "2026-07-23",
          "Types de PM": "Trimestrielle",
          "FE names": "Ibrahima Ndiaye",
          "PM date execute": "2026-07-23",
          "PM date replanifiée": "",
          "status": "Exécuté"
        },
        {
          id: "row-02",
          "ID": "SITE_TH_02",
          "PM number": "PM-2026-1002",
          "Nom du site": "Site Thiès Gare",
          "Region": "THIES",
          "PM Date": "2026-07-23",
          "Types de PM": "Semestrielle",
          "FE names": "Moustapha Diop",
          "PM date execute": "",
          "PM date replanifiée": "",
          "status": "Planifié"
        }
      ];
      res.json({ success: true, isDemo: true, rows: fallbackRows });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        watch: {
          ignored: ['**/server-debug.log']
        }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Set server timeouts to handle large uploads (though mostly handled by Firebase now)
  serverInstance.timeout = 600000; // 10 minutes
  serverInstance.keepAliveTimeout = 65000;
  serverInstance.headersTimeout = 66000;
}

startServer();
