require('dotenv').config();
const https = require('https');

function get(url, key) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        'Authorization': `Bearer ${key}`,
        'apikey': key
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, raw: data });
      });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    req.end();
  });
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or key');
    process.exit(1);
  }
  const base = url.replace(/\/$/, '');
  const endpoints = [
    {
      name: 'appointments columns',
      url: `${base}/rest/v1/appointments?select=completion_date,cancellation_reason,cancellation_date&limit=1`
    },
    {
      name: 'service_records updated_at',
      url: `${base}/rest/v1/service_records?select=id,updated_at&limit=1`
    },
    {
      name: 'reminders columns',
      url: `${base}/rest/v1/reminders?select=id,user_id,vehicle_vin,title,description,reminder_type,due_date,due_mileage,is_completed,is_recurring,recurrence_interval,priority,notification_sent,created_at&limit=1`
    },
    {
      name: 'scheduled_notifications exists',
      url: `${base}/rest/v1/scheduled_notifications?select=id,user_id,scheduled_for&limit=1`
    },
    {
      name: 'notifications exists',
      url: `${base}/rest/v1/notifications?select=id,user_id,title,message,type,status,created_at&limit=1`
    }
  ];
  let ok = 0, fail = 0;
  for (const e of endpoints) {
    const r = await get(e.url, key);
    if (r.status && r.status >= 200 && r.status < 300) {
      console.log('✓', e.name, '-', r.status);
      ok++;
    } else {
      console.log('✗', e.name, '-', r.status || r.error);
      if (r.raw) console.log(r.raw);
      fail++;
    }
  }
  console.log(`Summary: OK=${ok} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
}

main();
