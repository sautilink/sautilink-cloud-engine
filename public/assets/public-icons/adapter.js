/* Public presentation only. Controls, text, navigation and requests remain owned by each site. */
(() => {
 'use strict';
 const root=document.querySelector('body[data-public-icons]');
 const runtime=window.SautiPublicIcons;
 if(!root||!runtime?.renderIcon)return;
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const records=new Map();
 const attrs=['viewBox','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin'];
 const selector='[data-public-icon]';
 let queued=false;
 function isVisible(r){return r.svg.isConnected&&r.inView&&document.visibilityState!=='hidden'&&!r.svg.closest('[hidden],[inert]')&&r.svg.getClientRects().length>0;}
 function stop(r){clearTimeout(r.timer);r.timer=null;r.player?.destroy();r.player=null;}
 function draw(r){
  stop(r);
  const fresh=runtime.renderIcon(r.name,24,document);
  for(const name of attrs){const value=fresh.getAttribute(name);if(value!==null)r.svg.setAttribute(name,value);}
  for(const key of fresh.style)r.svg.style.setProperty(key,fresh.style.getPropertyValue(key));
  r.svg.replaceChildren(...fresh.childNodes);
  r.svg.dataset.publicIconReady='true';
 }
 function play(r){
  if(motion.matches||!isVisible(r)||r.control?.disabled)return;
  draw(r);
  try{r.player=runtime.play(r.svg,r.name,{duration:.7});r.player.start();r.timer=setTimeout(()=>{if(r.svg.isConnected)draw(r);else cleanup(r);},1900);}catch(_){draw(r);}
 }
 function cleanup(r){stop(r);intersection?.unobserve(r.svg);for(const [type,fn]of r.events)r.control?.removeEventListener(type,fn);records.delete(r.svg);}
 const intersection='IntersectionObserver'in window?new IntersectionObserver(entries=>{
  for(const entry of entries){const r=records.get(entry.target);if(!r)continue;r.inView=entry.isIntersecting;if(!r.inView){if(r.player)draw(r);}else if(!r.introduced){r.introduced=true;if(r.svg.closest('h1,h2,h3,[data-public-icon-intro]'))play(r);}}
 },{threshold:.2}):null;
 function enhance(host){
  const svg=host.localName==='svg'?host:host.querySelector('svg');
  const name=host.dataset.publicIcon;
  if(!svg||!runtime.catalog[name])return;
  let record=records.get(svg);
  if(record){if(record.name!==name){record.name=name;draw(record);}return;}
  const control=svg.closest('a,button,summary,[role="tab"],[data-public-icon-trigger]');
  record={svg,name,control,inView:!intersection,introduced:false,events:[],player:null,timer:null};
  records.set(svg,record);svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  draw(record);
  if(control)for(const type of ['pointerenter','focusin','pointerdown']){const fn=()=>play(record);record.events.push([type,fn]);control.addEventListener(type,fn,{passive:true});}
  intersection?.observe(svg);
 }
 function scan(){
  queued=false;
  for(const r of records.values())if(!r.svg.isConnected)cleanup(r);
  root.querySelectorAll(selector).forEach(enhance);
 }
 const observer=new MutationObserver(mutations=>{
  if(!mutations.some(m=>m.type==='attributes'&&m.attributeName==='data-public-icon'||m.type==='childList'&&[...m.addedNodes,...m.removedNodes].some(n=>n.nodeType===1&&(n.matches?.(selector)||n.querySelector?.(selector)))))return;
  if(!queued){queued=true;queueMicrotask(scan);}
 });
 scan();observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['data-public-icon']});
 const settle=()=>{for(const r of records.values())if(r.player)draw(r);};
 motion.addEventListener('change',settle);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')settle();});
 window.addEventListener('pagehide',event=>{if(event.persisted){settle();return;}observer.disconnect();intersection?.disconnect();for(const r of [...records.values()])cleanup(r);});
 window.addEventListener('pageshow',event=>{if(event.persisted)scan();});
})();
