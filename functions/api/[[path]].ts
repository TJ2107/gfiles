/* eslint-disable */
export const onRequest = async (context: any) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/$/, '').toLowerCase();
  const method = request.method;

  // Set up standard CORS headers for maximum compatibility
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, ApiKey',
  };

  // Handle preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const getResponse = async () => {
    // 1. GET /api/health
    if (pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', database: 'Firebase' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract apiKey with fallback
    const apiKey = request.headers.get('x-api-key') || env.RETABLE_API_KEY || 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM';

    // 2. GET /api/retable/workspaces
    if (pathname === '/api/retable/workspaces') {
      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM') {
        return new Response(JSON.stringify({
          isSthicLive: true,
          data: {
            workspaces: [
              { id: 'ws-sthic-live', name: 'STHIC Production' }
            ]
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      try {
        const response = await fetch('https://api.retable.io/v1/public/workspaces', {
          headers: { 'ApiKey': apiKey }
        });
        if (!response.ok) {
          throw new Error(`Retable API error: ${response.status}`);
        }
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
        return new Response(JSON.stringify({
          isDemo: true,
          data: {
            workspaces: [
              { id: 'ws-demo-01', name: 'Espace Démo - Suivi PM Retable (Fallback)' }
            ]
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 3. GET /api/retable/projects
    if (pathname === '/api/retable/projects') {
      const workspaceId = url.searchParams.get('workspaceId');

      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' || workspaceId === 'ws-sthic-live') {
        return new Response(JSON.stringify({
          isSthicLive: true,
          data: {
            projects: [
              { id: 'proj-sthic-live', name: 'Suivi PM & Maintenances' }
            ]
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' || workspaceId === 'ws-demo-01') {
        return new Response(JSON.stringify({
          isDemo: true,
          data: {
            projects: [
              { id: 'proj-demo-01', name: 'Projet Maintenance Télécom 2026' }
            ]
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (!workspaceId) {
        return new Response(JSON.stringify({ error: 'workspaceId is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      try {
        const response = await fetch(`https://api.retable.io/v1/public/workspaces/${workspaceId}/projects`, {
          headers: { 'ApiKey': apiKey }
        });
        if (!response.ok) throw new Error(`Retable API error: ${response.status}`);
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
        return new Response(JSON.stringify({
          isDemo: true,
          data: {
            projects: [
              { id: 'proj-demo-01', name: 'Projet Maintenance Télécom 2026 (Fallback)' }
            ]
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 4. GET /api/retable/tables
    if (pathname === '/api/retable/tables') {
      const projectId = url.searchParams.get('projectId');

      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' || projectId === 'proj-sthic-live') {
        return new Response(JSON.stringify({
          isSthicLive: true,
          data: {
            tables: [
              { id: 'tab-sthic-live', title: 'Planification PM (STHIC Live)' }
            ]
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' || projectId === 'proj-demo-01') {
        return new Response(JSON.stringify({
          isDemo: true,
          data: {
            tables: [
              { id: 'tab-demo-01', title: 'Suivi PM Sénégal Global' }
            ]
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (!projectId) {
        return new Response(JSON.stringify({ error: 'projectId is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      try {
        const response = await fetch(`https://api.retable.io/v1/public/projects/${projectId}/tables`, {
          headers: { 'ApiKey': apiKey }
        });
        if (!response.ok) throw new Error(`Retable API error: ${response.status}`);
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
        return new Response(JSON.stringify({
          isDemo: true,
          data: {
            tables: [
              { id: 'tab-demo-01', title: 'Suivi PM Sénégal Global (Fallback)' }
            ]
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 5. GET /api/retable/data
    if (pathname === '/api/retable/data') {
      const retableId = url.searchParams.get('retableId');

      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' || retableId === 'tab-sthic-live') {
        try {
          const assignmentsRes = await fetch('https://sthic-maintenances-generateurs.pages.dev/api/pm-assignments', {
            headers: { 'x-api-key': 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' }
          });
          if (!assignmentsRes.ok) {
            throw new Error(`Failed to fetch assignments: ${assignmentsRes.status}`);
          }
          const assignmentsJson: any = await assignmentsRes.json();
          const assignments = assignmentsJson.assignments || [];

          let sitesMap = new Map();
          try {
            const sitesRes = await fetch('https://sthic-maintenances-generateurs.pages.dev/api/sites', {
              headers: { 'x-api-key': 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' }
            });
            if (sitesRes.ok) {
              const sitesJson: any = await sitesRes.json();
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

          const rows = assignments.map((asg: any) => {
            const siteName = sitesMap.get(String(asg.siteId)) || asg.siteCode || 'Site Inconnu';
            
            let statusText = 'Planifié';
            if (asg.pmState === 'Closed Complete' || asg.closedAt) {
              statusText = 'Exécuté';
            } else if (asg.reprogrammationDate) {
              statusText = 'Replanifié';
            } else {
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

          return new Response(JSON.stringify({ success: true, isSthicLive: true, rows }), { headers: { 'Content-Type': 'application/json' } });
        } catch (err) {
          return new Response(JSON.stringify({ success: true, isDemo: true, rows: getDemoRows() }), { headers: { 'Content-Type': 'application/json' } });
        }
      }

      const demoRows = getDemoRows();

      if (apiKey === 'Si6JXVXPpNJ1xS7-IfS43OJUfrzlGUqeXY-A-IhFHHCnKwMVgF5xKfAn-dBZTGKM' || retableId === 'tab-demo-01') {
        const rows = demoRows.map((row: any) => {
          const flatRow: any = { id: row.id };
          Object.keys(row.cell_values).forEach((key) => {
            flatRow[key] = (row.cell_values as any)[key];
          });
          return flatRow;
        });
        return new Response(JSON.stringify({ success: true, isDemo: true, rows }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (!retableId) {
        return new Response(JSON.stringify({ error: 'retableId is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      try {
        const response = await fetch(`https://api.retable.io/v1/public/retable/${retableId}/data`, {
          headers: { 'ApiKey': apiKey }
        });
        if (!response.ok) throw new Error(`Retable API error: ${response.status}`);
        const json: any = await response.json();
        
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

        return new Response(JSON.stringify({ success: true, rows }), { headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
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
        return new Response(JSON.stringify({ success: true, isDemo: true, rows: fallbackRows }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // --- CLOUDFLARE D1 SQL DATABASE ENDPOINTS ---
    
    // A. GET /api/auth/users (Fetch all registered users)
    if (pathname === '/api/auth/users') {
      if (env.DB) {
        try {
          const { results } = await env.DB.prepare("SELECT uid, email, display_name as displayName, role FROM users").all();
          return new Response(JSON.stringify({ success: true, users: results }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      } else {
        return new Response(JSON.stringify({
          success: true,
          isMock: true,
          users: [{ uid: 'admin-id', email: 'cyber.kan587@gmail.com', displayName: 'Administrateur', role: 'Admin' }]
        }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // B. POST /api/auth/login (Verify login against database)
    if (pathname === '/api/auth/login' && method === 'POST') {
      try {
        const body = await request.json();
        const { email, password } = body;
        if (env.DB) {
          const user: any = await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)").bind(email).first();
          if (!user) {
            return new Response(JSON.stringify({ error: "Utilisateur non trouvé dans Cloudflare D1." }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }
          if (user.password !== password) {
            return new Response(JSON.stringify({ error: "Mot de passe incorrect." }), { status: 401, headers: { 'Content-Type': 'application/json' } });
          }
          const sessionUser = { uid: user.uid, email: user.email, displayName: user.display_name, role: user.role };
          return new Response(JSON.stringify({ success: true, user: sessionUser }), { headers: { 'Content-Type': 'application/json' } });
        } else {
          // Local fallback login
          if (email.toLowerCase() === 'cyber.kan587@gmail.com' && password === 'admin') {
            return new Response(JSON.stringify({
              success: true,
              user: { uid: 'admin-id', email: 'cyber.kan587@gmail.com', displayName: 'Administrateur', role: 'Admin' }
            }), { headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({ error: "Identifiants incorrects ou D1 non configuré." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // C. POST /api/auth/register (Create new user in database)
    if (pathname === '/api/auth/register' && method === 'POST') {
      try {
        const body = await request.json();
        const { email, password, displayName, role } = body;
        const uid = 'user-' + Math.random().toString(36).substring(2, 11);
        if (env.DB) {
          // Check if already exists
          const existing = await env.DB.prepare("SELECT uid FROM users WHERE LOWER(email) = LOWER(?)").bind(email).first();
          if (existing) {
            return new Response(JSON.stringify({ error: "Cet email est déjà utilisé." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          await env.DB.prepare("INSERT INTO users (uid, email, display_name, role, password) VALUES (?, ?, ?, ?, ?)")
            .bind(uid, email, displayName, role || 'User', password)
            .run();
          return new Response(JSON.stringify({ success: true, user: { uid, email, displayName, role: role || 'User' } }), { headers: { 'Content-Type': 'application/json' } });
        } else {
          return new Response(JSON.stringify({ error: "Création impossible, Cloudflare D1 non connecté." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // D. GET /api/d1/pm (Retrieve custom assignments/overrides from D1)
    if (pathname === '/api/d1/pm' && method === 'GET') {
      if (env.DB) {
        try {
          const { results } = await env.DB.prepare("SELECT * FROM pm_assignments ORDER BY planned_date DESC").all();
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
          return new Response(JSON.stringify({ success: true, rows: mappedRows }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      } else {
        return new Response(JSON.stringify({ success: true, isDemo: true, rows: [] }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // E. POST /api/d1/pm (Create/Update custom assignments or reschedule logs in D1)
    if (pathname === '/api/d1/pm' && method === 'POST') {
      try {
        const body = await request.json();
        const { id, site_code, pm_number, site_name, region, planned_date, maintenance_type, technician_name, executed_date, reprogrammed_date, status, comments } = body;
        if (env.DB) {
          await env.DB.prepare(`
            INSERT INTO pm_assignments (id, site_code, pm_number, site_name, region, planned_date, maintenance_type, technician_name, executed_date, reprogrammed_date, status, comments, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(pm_number) DO UPDATE SET
              site_code=coalesce(excluded.site_code, pm_assignments.site_code),
              site_name=coalesce(excluded.site_name, pm_assignments.site_name),
              region=coalesce(excluded.region, pm_assignments.region),
              planned_date=coalesce(excluded.planned_date, pm_assignments.planned_date),
              maintenance_type=coalesce(excluded.maintenance_type, pm_assignments.maintenance_type),
              technician_name=coalesce(excluded.technician_name, pm_assignments.technician_name),
              executed_date=excluded.executed_date,
              reprogrammed_date=excluded.reprogrammed_date,
              status=excluded.status,
              comments=excluded.comments,
              updated_at=CURRENT_TIMESTAMP
          `).bind(
            id, site_code, pm_number, site_name, region, planned_date, maintenance_type, technician_name, executed_date || null, reprogrammed_date || null, status, comments || null
          ).run();
          return new Response(JSON.stringify({ success: true, message: "Planning PM mis à jour avec succès dans Cloudflare D1." }), { headers: { 'Content-Type': 'application/json' } });
        } else {
          return new Response(JSON.stringify({ error: "Base D1 non connectée." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // F. POST /api/d1/sync-daily (Create/Update daily raw data in D1)
    if (pathname === '/api/d1/sync-daily' && method === 'POST') {
      try {
        const body = await request.json();
        const items = Array.isArray(body) ? body : [body];
        
        if (env.DB) {
          const stmt = env.DB.prepare(`
            INSERT INTO daily_raw_data (id, site_code, pm_number, site_name, region, planned_date, maintenance_type, technician_name, executed_date, reprogrammed_date, status, comments, imported_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(pm_number) DO UPDATE SET
              site_code=excluded.site_code,
              site_name=excluded.site_name,
              region=excluded.region,
              planned_date=excluded.planned_date,
              maintenance_type=excluded.maintenance_type,
              technician_name=excluded.technician_name,
              executed_date=excluded.executed_date,
              reprogrammed_date=excluded.reprogrammed_date,
              status=excluded.status,
              comments=excluded.comments,
              imported_at=CURRENT_TIMESTAMP
          `);
          
          const batch = items.map((item: any) => {
            const { id, site_code, pm_number, site_name, region, planned_date, maintenance_type, technician_name, executed_date, reprogrammed_date, status, comments } = item;
            return stmt.bind(id, site_code, pm_number, site_name, region, planned_date, maintenance_type, technician_name, executed_date || null, reprogrammed_date || null, status, comments || null);
          });
          
          await env.DB.batch(batch);
          return new Response(JSON.stringify({ success: true, message: "Raw data daily synced in D1." }), { headers: { 'Content-Type': 'application/json' } });
        } else {
          return new Response(JSON.stringify({ error: "Base D1 non connectée." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // G. GET /api/d1/sync-daily (Retrieve daily raw data from D1)
    if (pathname === '/api/d1/sync-daily' && method === 'GET') {
      if (env.DB) {
        try {
          const { results } = await env.DB.prepare("SELECT * FROM daily_raw_data ORDER BY imported_at DESC").all();
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
          return new Response(JSON.stringify({ success: true, rows: mappedRows }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      } else {
        return new Response(JSON.stringify({ success: true, rows: [] }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // H. GET /api/d1/global-files
    if (pathname === '/api/d1/global-files' && method === 'GET') {
      if (env.DB) {
        try {
          const { results } = await env.DB.prepare("SELECT raw_json FROM global_files ORDER BY updated_at DESC").all();
          const rows = results.map((r: any) => {
            try { return JSON.parse(r.raw_json); } catch { return null; }
          }).filter((r: any) => r !== null);
          return new Response(JSON.stringify({ success: true, rows }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      } else {
        return new Response(JSON.stringify({ success: true, rows: [] }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // I. POST /api/d1/global-files (Replace all data)
    if (pathname === '/api/d1/global-files' && method === 'POST') {
      try {
        const body = await request.json();
        const items = Array.isArray(body) ? body : [body];
        
        if (env.DB) {
          // Instead of deleting everything, we can do batch insert.
          // For simplicity, delete all existing and insert new batch (since it's a full replace usually).
          await env.DB.prepare("DELETE FROM global_files").run();
          
          const stmt = env.DB.prepare("INSERT INTO global_files (id, swo_number, pm_number, raw_json) VALUES (?, ?, ?, ?)");
          const batch = items.map((item: any) => {
            const id = 'row-' + Math.random().toString(36).substring(2, 9);
            const swo = item["N° SWO"] || '';
            const pm = item["PM number"] || '';
            const raw = JSON.stringify(item);
            return stmt.bind(id, swo, pm, raw);
          });
          
          // Execute in batches of 100 to avoid limits
          for (let i = 0; i < batch.length; i += 100) {
            await env.DB.batch(batch.slice(i, i + 100));
          }
          
          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        } else {
          return new Response(JSON.stringify({ error: "Base D1 non connectée." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // J. GET /api/d1/comments (Retrieve manual comments from D1)
    if (pathname === '/api/d1/comments' && method === 'GET') {
      if (env.DB) {
        try {
          const { results } = await env.DB.prepare("SELECT site_id, category, comment, updated_at FROM manual_comments").all();
          return new Response(JSON.stringify({ success: true, comments: results }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      } else {
        return new Response(JSON.stringify({ success: true, comments: [] }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // K. POST /api/d1/comments (Save manual comment in D1)
    if (pathname === '/api/d1/comments' && method === 'POST') {
      try {
        const { site_id, category, comment } = await request.json();
        if (env.DB) {
          const id = `${site_id}_${category}`.replace(/[^a-zA-Z0-9_-]/g, '_');
          const updatedAt = Date.now();
          await env.DB.prepare(`
            INSERT INTO manual_comments (id, site_id, category, comment, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              comment = excluded.comment,
              updated_at = excluded.updated_at
          `).bind(id, site_id, category, comment, updatedAt).run();
          return new Response(JSON.stringify({ success: true, message: "Commentaire enregistré avec succès dans Cloudflare D1." }), { headers: { 'Content-Type': 'application/json' } });
        } else {
          return new Response(JSON.stringify({ error: "Base D1 non connectée." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  };

  const response = await getResponse();
  
  // Attach CORS headers to response
  Object.entries(corsHeaders).forEach(([key, val]) => {
    response.headers.set(key, val);
  });

  return response;
};

function getDemoRows() {
  return [
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
}
