// ============================================================
// COWRIE SHELL . NOTICE TO ALL STAFF
// The banner at the top of every Cowrie Shell page (staff, admin,
// finance, record, sign-in). What it says is not written here: the CEO
// or the COO writes it in Admin ("Notice to all staff"), and this file
// asks the database for whatever is up today. No notice, no banner.
// It can be shrunk to one line, never hidden; a new notice opens again.
// ============================================================
(function(){
  var URL = "https://bwlzhpgbyqxjhvedcxxu.supabase.co";
  var KEY = "sb_publishable_PXDNEH8B7bOCH4bl9K_4OA_bU0YbheV";
  var SESSION = "sb-bwlzhpgbyqxjhvedcxxu-auth-token";

  var TONES = {
    info:      { bg:"#eef5fb", line:"#c9dcec", ink:"#173a55", head:"#0f4c78", chip:"Notice",      icon:"i", dot:"#1f6fb2" },
    celebrate: { bg:"#fff6ee", line:"#f6d3b6", ink:"#3d2a1c", head:"#8a3d07", chip:"From the office", icon:"★", dot:"#f56e0f" },
    alert:     { bg:"#fff4f2", line:"#f1c9c3", ink:"#3b1f1b", head:"#7a1a12", chip:"Important",   icon:"!", dot:"#b42318" }
  };

  var css =
    ".dla-ntc{font-family:Poppins,system-ui,sans-serif;border-bottom:1px solid var(--n-line);background:var(--n-bg);color:var(--n-ink);position:relative;z-index:5}" +
    ".dla-ntc .dn-in{max-width:1040px;margin:0 auto;padding:16px 22px 18px;display:flex;gap:14px;align-items:flex-start}" +
    ".dla-ntc .dn-ic{flex:none;width:30px;height:30px;border-radius:50%;background:var(--n-dot);color:#fff;display:grid;place-items:center;font-weight:700;font-size:15px;margin-top:2px}" +
    ".dla-ntc .dn-body{flex:1;min-width:0}" +
    ".dla-ntc .dn-chip{display:inline-block;font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--n-dot);margin-bottom:2px}" +
    ".dla-ntc h2{font-size:17px;line-height:1.3;margin:0 0 6px;color:var(--n-head);font-weight:600;font-family:inherit}" +
    ".dla-ntc p{font-size:13.5px;line-height:1.55;margin:0 0 10px;max-width:80ch}" +
    ".dla-ntc ul{margin:0 0 10px 18px;padding:0;font-size:13.5px;line-height:1.55;max-width:84ch}" +
    ".dla-ntc li{margin:0 0 5px}" +
    ".dla-ntc a{color:var(--n-dot);font-weight:600}" +
    ".dla-ntc .dn-full > :last-child{margin-bottom:0}" +
    ".dla-ntc .dn-btn{flex:none;font:inherit;font-size:12px;background:#fff;border:1px solid var(--n-line);color:var(--n-head);border-radius:8px;padding:5px 11px;cursor:pointer}" +
    ".dla-ntc .dn-btn:hover{border-color:var(--n-dot)}" +
    ".dla-ntc .dn-short{display:none;font-size:13.5px;line-height:1.5}" +
    ".dla-ntc.dn-min .dn-in{padding:9px 22px;align-items:center}" +
    ".dla-ntc.dn-min .dn-ic{width:22px;height:22px;font-size:11px;margin:0}" +
    ".dla-ntc.dn-min .dn-full{display:none}" +
    ".dla-ntc.dn-min .dn-short{display:block}" +
    "@media (max-width:560px){.dla-ntc .dn-in{padding:14px 16px;flex-wrap:wrap}.dla-ntc .dn-body{flex:1 1 calc(100% - 44px)}" +
    ".dla-ntc .dn-btn{margin-left:44px}.dla-ntc.dn-min .dn-in{padding:9px 16px}}" +
    "@media print{.dla-ntc{display:none!important}}";

  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
    return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]; }); }
  // **bold** words
  function inline(s){
    return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  }
  // blank line = new paragraph; a line starting with "- " is a bullet
  function bodyHtml(text){
    var out = [], list = [], para = [];
    function flushP(){ if(para.length){ out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } }
    function flushL(){ if(list.length){ out.push("<ul><li>" + list.map(inline).join("</li><li>") + "</li></ul>"); list = []; } }
    String(text || "").replace(/\r/g, "").split("\n").forEach(function(line){
      var t = line.trim();
      if(!t){ flushP(); flushL(); return; }
      var m = t.match(/^[-*•]\s+(.*)$/);
      if(m){ flushP(); list.push(m[1]); } else { flushL(); para.push(t); }
    });
    flushP(); flushL();
    return out.join("");
  }

  function styleOnce(){
    if(document.getElementById("dla-ntc-css")) return;
    var st = document.createElement("style"); st.id = "dla-ntc-css"; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
  function vars(el, tone){
    var t = TONES[tone] || TONES.info;
    el.style.setProperty("--n-bg", t.bg); el.style.setProperty("--n-line", t.line);
    el.style.setProperty("--n-ink", t.ink); el.style.setProperty("--n-head", t.head); el.style.setProperty("--n-dot", t.dot);
    return t;
  }
  // build the banner for a notice; used for the real thing and for Admin's preview
  function build(n, preview){
    styleOnce();
    var box = document.createElement("div");
    box.className = "dla-ntc"; box.setAttribute("role", "region"); box.setAttribute("aria-label", "Notice to all staff");
    var t = vars(box, n.tone);
    box.innerHTML =
      '<div class="dn-in">' +
        '<div class="dn-ic" aria-hidden="true">' + t.icon + '</div>' +
        '<div class="dn-body">' +
          '<div class="dn-full"><div class="dn-chip">' + t.chip + '</div>' +
            '<h2>' + inline(n.title) + '</h2>' + bodyHtml(n.body) + '</div>' +
          '<div class="dn-short"><b>' + inline(n.short || n.title) + '</b></div>' +
        '</div>' +
        '<button class="dn-btn" type="button" aria-expanded="true">Show less</button>' +
      '</div>';
    var b = box.querySelector(".dn-btn");
    var key = "dla-notice-min:" + (n.id || "preview");
    function paint(min){
      box.classList.toggle("dn-min", min);
      b.textContent = min ? "Show more" : "Show less";
      b.setAttribute("aria-expanded", min ? "false" : "true");
    }
    var startMin = false;
    if(!preview){ try { startMin = localStorage.getItem(key) === "1"; } catch(e){} }
    paint(startMin);
    b.addEventListener("click", function(){
      var m = !box.classList.contains("dn-min"); paint(m);
      if(!preview){ try { localStorage.setItem(key, m ? "1" : "0"); } catch(e){} }
    });
    return box;
  }

  function token(){
    try {
      var s = JSON.parse(localStorage.getItem(SESSION) || "null");
      if(s && s.access_token && (!s.expires_at || s.expires_at * 1000 > Date.now() + 5000)) return s.access_token;
    } catch(e){}
    return null;
  }
  function ask(withToken){
    var h = { "apikey": KEY, "Content-Type": "application/json" };
    var tk = withToken ? token() : null;
    if(tk) h["Authorization"] = "Bearer " + tk;
    return fetch(URL + "/rest/v1/rpc/current_notice", { method:"POST", headers:h, body:"{}" })
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); });
  }
  function show(n){
    var old = document.getElementById("dla-notice");
    if(!n || !n.title){ if(old) old.remove(); return; }
    var box = build(n, false); box.id = "dla-notice";
    if(old) old.replaceWith(box); else document.body.insertBefore(box, document.body.firstChild);
  }
  function refresh(){
    return ask(true).catch(function(){ return ask(false); }).then(show).catch(function(){ /* no notice today */ });
  }

  window.dlaNotice = { refresh: refresh, build: build };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh); else refresh();
  // after someone signs in on this page, look again (a staff-only notice may now apply)
  window.addEventListener("storage", function(e){ if(e.key === SESSION) refresh(); });
  setTimeout(refresh, 4000);
})();
