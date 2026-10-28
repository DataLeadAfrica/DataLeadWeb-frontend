// ============================================================
// COWRIE SHELL . NOTICE FOR EVERYONE
// One banner at the top of every Cowrie Shell page (staff, admin,
// finance, record, sign-in). It can be shrunk to a single line, never
// hidden completely, so the advice stays one tap away.
//
// To take the notice down, set NOTICE_ON to false. To change it, edit
// the words below. Nothing else needs to change.
// ============================================================
(function(){
  var NOTICE_ON = true;
  var NOTICE_ID = "ebola-fct-2026-10";          // change this when the notice changes, so everyone sees it open again

  if(!NOTICE_ON || document.getElementById("dla-notice")) return;

  var STEPS = [
    "<b>Wash your hands often</b> with soap and running water, or use an alcohol-based sanitiser, especially after public transport, the market, a hospital visit or shaking hands.",
    "<b>Wipe shared surfaces every day:</b> desks, door handles, keyboards, phones, and the meeting and training rooms.",
    "<b>Do not touch the blood or body fluids</b> (vomit, stool, urine, saliva) of anyone who is ill, or the body of anyone who has died of an unexplained illness.",
    "<b>Avoid bush meat,</b> especially bats and monkeys.",
    "<b>If you feel unwell</b> with a fever, severe weakness, headache, muscle pain, sore throat, vomiting, diarrhoea or unexplained bleeding: <b>stay at home, tell your line manager, and call NCDC on <a href=\"tel:6232\">6232</a></b> before going to a hospital. Please do not self-medicate.",
    "<b>Share only official updates</b> from NCDC. Please do not forward rumours, and be kind to anyone who is unwell or being monitored."
  ];

  var css =
    "#dla-notice{font-family:Poppins,system-ui,sans-serif;background:#fff4f2;border-bottom:1px solid #f1c9c3;color:#3b1f1b;position:relative;z-index:5}" +
    "#dla-notice .dn-in{max-width:1040px;margin:0 auto;padding:16px 22px 18px;display:flex;gap:14px;align-items:flex-start}" +
    "#dla-notice .dn-ic{flex:none;width:30px;height:30px;border-radius:50%;background:#b42318;color:#fff;display:grid;place-items:center;font-weight:700;font-size:16px;margin-top:2px}" +
    "#dla-notice .dn-body{flex:1;min-width:0}" +
    "#dla-notice .dn-chip{display:inline-block;font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#b42318;margin-bottom:2px}" +
    "#dla-notice h2{font-size:17px;line-height:1.3;margin:0 0 6px;color:#7a1a12;font-weight:600;font-family:inherit}" +
    "#dla-notice p{font-size:13.5px;line-height:1.55;margin:0 0 10px;max-width:78ch}" +
    "#dla-notice ol{margin:0 0 10px 18px;padding:0;font-size:13.5px;line-height:1.55;max-width:84ch}" +
    "#dla-notice li{margin:0 0 5px}" +
    "#dla-notice a{color:#b42318;font-weight:600}" +
    "#dla-notice .dn-foot{font-size:12px;color:#7d5a55}" +
    "#dla-notice .dn-btn{flex:none;font:inherit;font-size:12px;background:#fff;border:1px solid #e3b1aa;color:#7a1a12;border-radius:8px;padding:5px 11px;cursor:pointer}" +
    "#dla-notice .dn-btn:hover{border-color:#b42318}" +
    "#dla-notice .dn-short{display:none;font-size:13.5px;line-height:1.5}" +
    "#dla-notice.dn-min .dn-in{padding:9px 22px;align-items:center}" +
    "#dla-notice.dn-min .dn-ic{width:22px;height:22px;font-size:12px;margin:0}" +
    "#dla-notice.dn-min .dn-full{display:none}" +
    "#dla-notice.dn-min .dn-short{display:block}" +
    "@media (max-width:560px){#dla-notice .dn-in{padding:14px 16px;flex-wrap:wrap}#dla-notice .dn-body{flex:1 1 calc(100% - 44px)}" +
    "#dla-notice .dn-btn{margin-left:44px}#dla-notice.dn-min .dn-in{padding:9px 16px}}" +
    "@media print{#dla-notice{display:none!important}}";

  var html =
    '<div class="dn-in">' +
      '<div class="dn-ic" aria-hidden="true">!</div>' +
      '<div class="dn-body">' +
        '<div class="dn-full">' +
          '<div class="dn-chip">Health alert</div>' +
          '<h2>Ebola: a confirmed case in the FCT</h2>' +
          '<p>The Nigeria Centre for Disease Control (NCDC) has confirmed a case of Ebola in the FCT. ' +
            'There is no need to panic, but please take these simple steps to protect yourself, your family and your colleagues.</p>' +
          '<ol><li>' + STEPS.join('</li><li>') + '</li></ol>' +
          '<div class="dn-foot">NCDC toll-free: <a href="tel:6232">6232</a> or <a href="tel:080097000010">0800-970000-10</a>. ' +
            'Information from NCDC, 25 October 2026. If you have any worries, speak to your line manager.</div>' +
        '</div>' +
        '<div class="dn-short"><b>Health alert: Ebola case confirmed in the FCT.</b> Wash your hands often. ' +
          'If you feel unwell, stay at home and call NCDC on <a href="tel:6232">6232</a>.</div>' +
      '</div>' +
      '<button class="dn-btn" type="button" aria-expanded="true">Show less</button>' +
    '</div>';

  function key(){ return "dla-notice-min:" + NOTICE_ID; }
  function isMin(){ try { return localStorage.getItem(key()) === "1"; } catch(e){ return false; } }
  function remember(v){ try { localStorage.setItem(key(), v ? "1" : "0"); } catch(e){} }

  function mount(){
    if(document.getElementById("dla-notice")) return;
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    var box = document.createElement("div");
    box.id = "dla-notice"; box.setAttribute("role", "region"); box.setAttribute("aria-label", "Health alert");
    box.innerHTML = html;
    document.body.insertBefore(box, document.body.firstChild);
    var b = box.querySelector(".dn-btn");
    function paint(min){
      box.classList.toggle("dn-min", min);
      b.textContent = min ? "Show advice" : "Show less";
      b.setAttribute("aria-expanded", min ? "false" : "true");
    }
    paint(isMin());
    b.addEventListener("click", function(){ var m = !box.classList.contains("dn-min"); paint(m); remember(m); });
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
