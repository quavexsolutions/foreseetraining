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
  // Cloudflare Turnstile: checks a real person (not a bot) is signing up, signing in or sending a form.
  // Switched on by adding turnstileSiteKey to config.js (plus the secret key in Supabase). People see a small "Verifying… / Success" box for a moment.
  var tsLoading = null, tsBox = null, tsId = null;
  function humanErr() { var e = new Error("We couldn’t check that you’re a real person. Please refresh the page and try again."); e.code = "captcha"; return e; }
  function tsScript() {
    if (window.turnstile) return Promise.resolve();
    if (!tsLoading) tsLoading = new Promise(function (ok, no) {
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true;
      s.onload = function () { ok(); }; s.onerror = function () { tsLoading = null; no(humanErr()); };
      document.head.appendChild(s);
    });
    return tsLoading;
  }
  // The check shown on the form itself (sign-up, sign-in, join, activation): it runs as soon as the form appears,
  // and its pass is used when the button is pressed. Elsewhere a small box pops up at the bottom of the screen instead.
  var tsInline = null;
  function mount(el) {
    if (!C.turnstileSiteKey || !el || !el.offsetParent) return;
    if (tsInline && tsInline.el === el) return;
    if (tsInline && tsInline.id !== null) { try { window.turnstile.remove(tsInline.id); } catch (e) {} }
    var w = { el: el, id: null, token: null, waiters: [] }; tsInline = w;
    tsScript().then(function () {
      if (tsInline !== w || !document.body.contains(el)) return;
      w.id = window.turnstile.render(el, { sitekey: C.turnstileSiteKey, appearance: "always", size: "flexible",
        callback: function (tok) { w.token = tok; w.waiters.splice(0).forEach(function (x) { x.ok(tok); }); },
        "expired-callback": function () { w.token = null; },
        "error-callback": function () { w.waiters.splice(0).forEach(function (x) { x.no(humanErr()); }); return true; } });
    }).catch(function () {});
  }
  async function human() {
    if (!C.turnstileSiteKey) return undefined;
    var w = tsInline;
    if (w && w.id !== null && document.body.contains(w.el)) {
      var tok = w.token || await new Promise(function (ok, no) { w.waiters.push({ ok: ok, no: no }); setTimeout(function () { no(humanErr()); }, 120000); });
      w.token = null; try { window.turnstile.reset(w.id); } catch (e) {}   // a pass works once: get a fresh one ready
      return tok;
    }
    await tsScript();
    if (!tsBox) { tsBox = document.createElement("div"); tsBox.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;border-radius:12px"; document.body.appendChild(tsBox); }
    return new Promise(function (ok, no) {
      var done = false;
      function card(on) { tsBox.style.display = on ? "block" : "none"; tsBox.style.background = "#fff"; tsBox.style.padding = "10px"; tsBox.style.boxShadow = "0 8px 30px rgba(0,0,0,.2)"; tsBox.style.width = "min(320px, calc(100vw - 32px))"; }
      // Leave the "Success" tick on screen for a moment so people see the check happen
      function finish(f, v) { if (done) return; done = true; clearTimeout(t); if (f === ok) setTimeout(function () { card(false); }, 900); else card(false); f(v); }
      var t = setTimeout(function () { finish(no, humanErr()); }, 120000);
      try {
        if (tsId !== null) { try { window.turnstile.remove(tsId); } catch (e) {} }
        card(true);
        tsId = window.turnstile.render(tsBox, { sitekey: C.turnstileSiteKey, appearance: "always", execution: "execute", size: "flexible",
          callback: function (tok) { finish(ok, tok); }, "error-callback": function () { finish(no, humanErr()); return true; } });
        window.turnstile.execute(tsId);
      } catch (e) { finish(no, humanErr()); }
    });
  }
  window.FT = { live: live, sb: sb, call: call, human: human, mount: mount };
})();
