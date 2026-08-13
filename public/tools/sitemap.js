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
  document.getElementById("score-version").textContent=`Score model v${sec.version||"1.0"} · quality assessment only`;
  const pct=Math.max(0,Math.min(100,sec.percentage??sec.total??0));
  document.getElementById("score-bar").setAttribute("aria-valuenow",String(pct));
  document.getElementById("score-bar-fill").style.width=`${pct}%`;
  const cats=document.getElementById("score-cats");
  if(sec.categories){cats.innerHTML=Object.entries(sec.categories).map(([k,c])=>`<li><span>${escapeHtml(k)}</span><span>${c.score}/${c.max}</span></li>`).join("");}
  const st=data.stats||{};
  document.getElementById("meta-grid").innerHTML=`
    <div><dt>Type</dt><dd><code>${escapeHtml(data.type||"")}</code></dd></div>
    <div><dt>Found</dt><dd><code>${data.found?"yes":"no"}</code></dd></div>
    <div><dt>Status</dt><dd><code>${escapeHtml(String(data.status??""))}</code></dd></div>
    <div><dt>Discovery</dt><dd><code>${escapeHtml(data.discovery?.source||"")}</code></dd></div>
    <div><dt>URLs (analyzed)</dt><dd><code>${escapeHtml(String(st.urls??0))}</code></dd></div>
    <div><dt>Duplicates</dt><dd><code>${escapeHtml(String(st.duplicates??0))}</code></dd></div>
    <div><dt>Final URL</dt><dd><code>${escapeHtml(data.finalUrl||"")}</code></dd></div>
  `;
  const fl=sec.findings||[];
  document.getElementById("findings-list").innerHTML=fl.length?fl.map(f=>`<li class="${escapeHtml(f.severity||"info")}"><strong>${escapeHtml(f.title||f.code)}</strong> — ${escapeHtml(f.message||"")}</li>`).join(""):"<li>No findings.</li>";
  const rl=sec.recommendations||[];
  document.getElementById("recs-list").innerHTML=rl.length?rl.map(r=>`<li><strong>${escapeHtml(r.title||r.code)}</strong> — ${escapeHtml(r.message||"")}</li>`).join(""):"<li>No recommendations.</li>";
  const urls=data.urls||[];
  document.getElementById("urls-body").innerHTML=urls.length?`<ul class="url-list">${urls.map(u=>`<li><code>${escapeHtml(u.loc)}</code></li>`).join("")}</ul>`:`<p class="empty">No URL sample.</p>`;
  const ch=data.sitemaps||[];
  document.getElementById("children-body").innerHTML=ch.length?`<ul>${ch.map(c=>`<li><code>${escapeHtml(c.loc)}</code> · ${c.found?"ok":"miss"}</li>`).join("")}</ul>`:`<p class="empty">No child sitemaps fetched.</p>`;
  document.getElementById("results").hidden=false;
}

async function runCheck(url){
  const submit=document.getElementById("sitemap-submit");
  setError("");setStatus("Analyzing sitemap…","loading");
  document.getElementById("results").hidden=true;
  if(submit){submit.disabled=true;submit.textContent="Analyzing…";}
  try{
    const res=await fetch(`/api/sitemap?url=${encodeURIComponent(url)}`,{headers:{Accept:"application/json"}});
    const payload=await res.json();
    if(!payload?.success){
      const msg=payload?.error?.message||"Unable to analyze sitemap.";
      setStatus(msg,"error");
      if(payload?.error?.code&&/INVALID|MISSING|PRIVATE|SSRF|CREDENTIAL/.test(payload.error.code)) setError(msg);
      return;
    }
    setStatus("");render(payload.data);
  }catch(err){setStatus(`Network error: ${err?.message||"failed"}`,"error");}
  finally{if(submit){submit.disabled=false;submit.textContent="Analyze";}}
}

document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("sitemap-form")?.addEventListener("submit",e=>{e.preventDefault();const v=document.getElementById("url-input").value.trim();if(!v){setError("Enter a URL");return;}runCheck(v);});
  const pre=new URLSearchParams(location.search).get("url");if(pre){document.getElementById("url-input").value=pre;runCheck(pre.trim());}
  const toggle=document.getElementById("nav-toggle");const nav=document.querySelector(".nav");
  toggle?.addEventListener("click",()=>{const open=nav.classList.toggle("open");toggle.setAttribute("aria-expanded",open?"true":"false");});
  const y=document.getElementById("year");if(y)y.textContent=String(new Date().getFullYear());
});
