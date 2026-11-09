// Foresee Training: the only place the website talks to the server (Supabase).
(function () {
  var C = window.FT_CONFIG || {};
  var live = !!(C.supabaseUrl && C.supabaseKey && window.supabase);
  var sb = live ? window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;
  async function call(fn, body) {
    var s = (await sb.auth.getSession()).data.session;
    var r, j = null;
    try {
      r = await fetch(C.supabaseUrl.replace(/\/$/, "") + "/functions/v1/" + fn, { method: "POST",
        headers: Object.assign({ "Content-Type": "application/json", apikey: C.supabaseKey }, s ? { Authorization: "Bearer " + s.access_token } : {}),
        body: JSON.stringify(body || {}) });
    } catch (e) { var n = new Error("We couldn’t reach the server. Check your connection and try again."); n.status = 0; throw n; }
    try { j = await r.json(); } catch (e) {}
    if (!r.ok) { var err = new Error((j && j.error) || "Something went wrong. Please try again."); err.code = j && j.code; err.status = r.status; throw err; }
    return j;
  }
  window.FT = { live: live, sb: sb, call: call };
})();
