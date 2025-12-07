// api/consent.js
// Simple Vercel serverless function: inserts consent record into Supabase and optionally posts to Discord webhook.

const crypto = require('crypto');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    const body = req.body || {};
    if (!body.consent) {
      return res.status(400).json({ ok: false, error: 'consent not provided' });
    }

    // Get IP (respect X-Forwarded-For)
    const forwarded = (req.headers['x-forwarded-for'] || '').toString();
    const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || null;
    const ua = req.headers['user-agent'] || '';
    const now = new Date().toISOString();

    // Optionally hash IP before storing (recommended for privacy)
    let storedIp = ip;
    if (process.env.HASH_IP === '1' && ip) {
      const salt = process.env.HASH_SALT || '';
      storedIp = crypto.createHash('sha256').update(ip + salt).digest('hex');
    }

    // Insert into Supabase via REST (requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        await fetch(${supabaseUrl}/rest/v1/ips, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': Bearer ${supabaseKey},
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            ip: storedIp,
            forwarded_for: forwarded || null,
            user_agent: ua,
            consent_time: now
          })
        });
      } catch (err) {
        console.error('Supabase insert error:', err);
      }
    } else {
      console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set; skipping DB insert');
    }

    // Send to Discord webhook (optional)
    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        const discordPayload = {
          content: New consent recorded\nIP: ${storedIp  'N/A'}\nForwarded: ${forwarded  'N/A'}\nUA: ${ua}\nTime: ${now}
        };
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload)
        });
      } catch (err) {
        console.error('Discord webhook error:', err);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Unexpected error in /api/consent:', e);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
};