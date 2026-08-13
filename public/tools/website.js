function escapeHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function setError(msg){const el=document.getElementById("url-error");if(!el)return;el.hidden=!msg;el.textContent=msg||"";}
function setStatus(msg,kind){const el=document.getElementById("status");if(!el)return;if(!msg){el.hidden=true;el.textContent="";el.className="tool-status";return;}el.hidden=false;el.textContent=msg;el.className="tool-status"+(kind?` ${kind}`:"");}

function render(data){
  const sec=data.score||{};
  document.getElementById("score-total").textContent=`${sec.total??"—"} / ${sec.max??100}`;
  document.getElementById("score-grade").textContent=sec.grade||"";
  document.getElementById("score-label").textContent=sec.label||"";
  document.getElementById("score-version").textContent=`Score model v${sec.version||"1.0"} · not a Google/Lighthouse ranking score`;
  const pct=Math.max(0,Math.min(100,sec.percentage??sec.total??0));
  document.getElementById("score-bar").setAttribute("aria-valuenow",String(pct));
  document.getElementById("score-bar-fill").style.width=`${pct}%`;
  const cats=document.getElementById("score-cats");
  if(sec.categories){cats.innerHTML=Object.entries(sec.categories).map(([k,c])=>`<li><span>${escapeHtml(k)}</span><span>${c.score}/${c.max}</span></li>`).join("");}

  document.getElementById("meta-grid").innerHTML=`
    <div><dt>Final URL</dt><dd><code>${escapeHtml(data.finalUrl||"")}</code></dd></div>
    <div><dt>Status</dt><dd><code>${escapeHtml(String(data.status))} ${escapeHtml(data.statusText||"")}</code></dd></div>
    <div><dt>Time</dt><dd><code>${escapeHtml(String(data.responseTimeMs??"—"))} ms</code></dd></div>
    <div><dt>Type</dt><dd><code>${escapeHtml(data.contentType||"")}</code></dd></div>
    <div><dt>Redirects</dt><dd><code>${escapeHtml(String(data.redirectCount??0))}</code></dd></div>
  `;

  const fl=sec.findings||[];
  document.getElementById("findings-list").innerHTML=fl.length?fl.map(f=>`<li class="${escapeHtml(f.severity||"info")}"><strong>${escapeHtml(f.title||f.code)}</strong> — ${escapeHtml(f.message||"")}</li>`).join(""):"<li>No findings.</li>";
  const rl=sec.recommendations||[];
  document.getElementById("recs-list").innerHTML=rl.length?rl.map(r=>`<li><strong>${escapeHtml(r.title||r.code)}</strong> — ${escapeHtml(r.message||"")}</li>`).join(""):"<li>No recommendations.</li>";

  const seo=data.seo||{};
  document.getElementById("seo-body").innerHTML=`
    <p><strong>Title</strong> (${seo.title?.status||""}): ${escapeHtml(seo.title?.value||"(none)")} <span class="muted">(${seo.title?.length??0} chars)</span></p>
    <p><strong>Description</strong> (${seo.description?.status||""}): ${escapeHtml((seo.description?.value||"(none)").slice(0,200))}</p>
    <p><strong>Viewport</strong>: ${seo.viewport?.found?escapeHtml(seo.viewport.value||"yes"):"missing"}</p>
    <p><strong>Lang</strong>: ${escapeHtml(seo.language?.value||"missing")}</p>
    <p><strong>Canonical</strong>: ${escapeHtml(seo.canonical?.value||"missing")}</p>
    <p><strong>Robots meta</strong>: ${escapeHtml(seo.robots?.content||"(none)")}</p>
  `;

  const h=data.headings||{};
  document.getElementById("headings-body").innerHTML=`
    <p>H1: ${h.counts?.h1??0} · H2: ${h.counts?.h2??0} · H3: ${h.counts?.h3??0}</p>
    <ul>${(h.h1||[]).slice(0,5).map(t=>`<li>H1: ${escapeHtml(t)}</li>`).join("")||"<li class=\"muted\">No H1 sample</li>"}</ul>
  `;

  const img=data.images||{};
  const ln=data.links||{};
  document.getElementById("media-body").innerHTML=`
    <p>Images: ${img.total??0} · with alt ${img.withAlt??0} · missing alt ${img.missingAlt??0} · empty alt ${img.emptyAlt??0}</p>
    <p>Links: ${ln.total??0} · internal ${ln.internal??0} · external ${ln.external??0} · nofollow ${ln.nofollow??0}</p>
    <p class="muted">Links and images are not fetched; classification is local only.</p>
  `;

  const soc=data.social||{};
  document.getElementById("social-body").innerHTML=`
    <p>Open Graph: ${soc.openGraph?.present?"present":"missing"}${soc.openGraph?.title?` — ${escapeHtml(soc.openGraph.title)}`:""}</p>
    <p>Twitter/X: ${soc.twitter?.present?"present":"missing"}${soc.twitter?.card?` — card ${escapeHtml(soc.twitter.card)}`:""}</p>
  `;

  const s=data.security||{};
  document.getElementById("security-body").innerHTML=`
    <ul class="flags">
      <li>HTTPS: ${s.https?"yes":"no"}</li>
      <li>HSTS: ${s.hsts?"yes":"no"}</li>
      <li>CSP: ${s.csp?"yes":"no"}</li>
      <li>X-Content-Type-Options: ${s.xContentTypeOptions?"yes":"no"}</li>
      <li>Clickjacking controls: ${s.xFrameOptions||s.frameAncestors?"yes":"no"}</li>
    </ul>
    <p class="muted">Compact summary only — use the Headers Analyzer for full header scoring.</p>
  `;

  document.getElementById("results").hidden=false;
}

async function runCheck(url){
  const submit=document.getElementById("website-submit");
  setError("");setStatus("Fetching and analyzing page…","loading");
  document.getElementById("results").hidden=true;
  if(submit){submit.disabled=true;submit.textContent="Analyzing…";}
  try{
    const res=await fetch(`/api/website?url=${encodeURIComponent(url)}`,{headers:{Accept:"application/json"}});
    const payload=await res.json();
    if(!payload?.success){
      const msg=payload?.error?.message||"Unable to analyze website.";
      setStatus(msg,"error");
      if(payload?.error?.code&&/INVALID|MISSING|PRIVATE|SSRF|CREDENTIAL/.test(payload.error.code)) setError(msg);
      return;
    }
    setStatus("");render(payload.data);
  }catch(err){setStatus(`Network error: ${err?.message||"failed"}`,"error");}
  finally{if(submit){submit.disabled=false;submit.textContent="Analyze";}}
}

document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("website-form")?.addEventListener("submit",e=>{e.preventDefault();const v=document.getElementById("url-input").value.trim();if(!v){setError("Enter a URL");return;}runCheck(v);});
  const pre=new URLSearchParams(location.search).get("url");if(pre){document.getElementById("url-input").value=pre;runCheck(pre.trim());}
  const toggle=document.getElementById("nav-toggle");const nav=document.querySelector(".nav");
  toggle?.addEventListener("click",()=>{const open=nav.classList.toggle("open");toggle.setAttribute("aria-expanded",open?"true":"false");});
  const y=document.getElementById("year");if(y)y.textContent=String(new Date().getFullYear());
});
