// api/consent.js
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

    const forwarded = (req.headers['x-forwarded-for'] || '').toString();
    const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || null;
    const ua = req.headers['user-agent'] || '';
    const now = new Date().toISOString();

    // Optionally hash IP for privacy
    let storedIp = ip;
    if (process.env.HASH_IP === '1' && ip) {
      const crypto = require('crypto');
      const salt = process.env.HASH_SALT || '';
      storedIp = crypto.createHash('sha256').update(ip + salt).digest('hex');
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      // NOTE: use template string with backticks -> ${supabaseUrl}/rest/v1/ips
      await fetch(${supabaseUrl}/rest/v1/ips, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': Bearer ${supabaseKey},
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          ip: storedIp,
          forwarded_for: forwarded || null,
          user_agent: ua,
          consent_time: now
        })
      });
    } else {
      console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set; skipping DB insert');
    }

    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: New consent recorded\nIP: ${storedIp  'N/A'}\nForwarded: ${forwarded  'N/A'}\nUA: ${ua}\nTime: ${now}
          })
        });
      } catch (err) {
        console.error('Discord webhook send error:', err);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error in /api/consent:', err);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
};
