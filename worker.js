const BRAND = "Lysekil Buss";
const POSTS_KEY = "tanum:posts:v2";
const PIN_DEFAULT = "2468";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=58.72&longitude=11.32&current=temperature_2m,weather_code&timezone=Europe%2FStockholm";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, {headers:corsHeaders()});
    const kv = env.INFO_KV;
    if (!kv) return new Response("Konfiguration saknas: KV-bindningen INFO_KV måste finnas.", {status:500});

    if (url.pathname === "/api/posts" && request.method === "GET") {
      const all = await readPosts(kv), now = Date.now();
      const live = all.filter(p => !p.paused && (!p.startAt || Date.parse(p.startAt) <= now) && (!p.endAt || Date.parse(p.endAt) > now));
      return json(live.map(({id,title,category,message,image,duration,footer})=>({id,title,category,message,image,duration,footer})));
    }
    if (url.pathname === "/api/weather" && request.method === "GET") {
      try {
        const r = await fetch(WEATHER_URL, {cf:{cacheTtl:900,cacheEverything:true}});
        if (!r.ok) throw new Error("weather");
        const d = await r.json();
        return json({temp:Math.round(d.current.temperature_2m), code:d.current.weather_code});
      } catch { return json({temp:null,code:null}); }
    }
    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      const b = await request.json().catch(()=>({}));
      const pin = String(env.ADMIN_PIN || PIN_DEFAULT);
      if (String(b.pin || "") !== pin) return json({error:"Fel PIN-kod."},401);
      return json({ok:true,token:await tokenFor(pin)});
    }
    if (url.pathname.startsWith("/api/admin/")) {
      if (!await isAdmin(request,env)) return json({error:"Logga in igen."},401);
      if (url.pathname === "/api/admin/posts" && request.method === "GET") return json(await readPosts(kv));
      if (url.pathname === "/api/admin/image" && request.method === "POST") {
        const b = await request.json().catch(()=>({}));
        if (!b.data || !/^data:image\/(jpeg|png|webp);base64,/.test(b.data)) return json({error:"Använd JPG, PNG eller WebP."},400);
        if (b.data.length > 2200000) return json({error:"Bilden är för stor. Välj en mindre bild."},413);
        const id = crypto.randomUUID();
        await kv.put("tanum:image:"+id,b.data);
        return json({image:"/media/"+id});
      }
      if (url.pathname === "/api/admin/posts" && request.method === "POST") {
        const b = await request.json().catch(()=>({}));
        if (!String(b.title||"").trim() || !String(b.message||"").trim()) return json({error:"Rubrik och meddelande måste fyllas i."},400);
        const posts = await readPosts(kv), id = b.id || crypto.randomUUID();
        const post = {
          id, title:String(b.title).trim().slice(0,100),
          category:String(b.category||"INFORMATION").slice(0,35),
          message:String(b.message).trim().slice(0,1600),
          image:String(b.image||"").slice(0,180),
          duration:Math.max(15,Math.min(600,Number(b.duration)||120)),
          startAt:String(b.startAt||""), endAt:String(b.endAt||""),
          paused:!!b.paused, footer:String(b.footer||"").slice(0,160),
          updatedAt:new Date().toISOString()
        };
        const i=posts.findIndex(p=>p.id===id);
        if(i>=0) posts[i]=post; else posts.push(post);
        await kv.put(POSTS_KEY,JSON.stringify(posts));
        return json({ok:true,post});
      }
      if (url.pathname.startsWith("/api/admin/posts/") && request.method === "DELETE") {
        const id=url.pathname.split("/").pop(), posts=await readPosts(kv);
        await kv.put(POSTS_KEY,JSON.stringify(posts.filter(p=>p.id!==id)));
        return json({ok:true});
      }
      if (url.pathname === "/api/admin/order" && request.method === "POST") {
        const b=await request.json().catch(()=>({})), posts=await readPosts(kv), ids=Array.isArray(b.ids)?b.ids:[];
        const map=new Map(posts.map(p=>[p.id,p]));
        const ordered=ids.map(id=>map.get(id)).filter(Boolean);
        for(const p of posts) if(!ids.includes(p.id)) ordered.push(p);
        await kv.put(POSTS_KEY,JSON.stringify(ordered));
        return json({ok:true});
      }
      return json({error:"Hittades inte."},404);
    }
    if (url.pathname.startsWith("/media/")) {
      const id=url.pathname.slice(7);
      if (!/^[a-f0-9-]{20,}$/i.test(id)) return new Response("Not found",{status:404});
      const value=await kv.get("tanum:image:"+id);
      if(!value) return new Response("Not found",{status:404});
      const mime=value.slice(5,value.indexOf(";"));
      const bytes=Uint8Array.from(atob(value.split(",")[1]),c=>c.charCodeAt(0));
      return new Response(bytes,{headers:{"content-type":mime,"cache-control":"public, max-age=86400"}});
    }
    if (url.pathname === "/admin" || url.pathname === "/admin/") return page(adminPage());
    return page(screenPage());
  }
};
async function readPosts(kv){try{return JSON.parse(await kv.get(POSTS_KEY)||"[]")}catch{return []}}
function json(v,status=200){return new Response(JSON.stringify(v),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
function page(s){return new Response(s,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}})}
function corsHeaders(){return {"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,DELETE,OPTIONS","access-control-allow-headers":"content-type,authorization"}}
async function tokenFor(pin){const bytes=new TextEncoder().encode(pin+"|tanum-infoscreen-admin-v2");const hash=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("")}
async function isAdmin(req,env){const pin=String(env.ADMIN_PIN||PIN_DEFAULT);return (req.headers.get("authorization")||"")==="Bearer "+await tokenFor(pin)}

const sharedCSS = `
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif}button,input,textarea,select{font:inherit}
:root{--navy:#08294e;--blue:#0755b8;--red:#e51d3f;--ink:#101827;--muted:#64748b}
body.screen{background:#071d38;color:white;overflow:hidden}
.tvhead{height:17vh;min-height:100px;max-height:175px;background:#082b52;border-bottom:5px solid #d6a72e;display:grid;grid-template-columns:1.15fr 1.45fr .8fr .38fr;align-items:center;padding:1.2vh 2.7vw;gap:1.2vw}
.brand{display:flex;align-items:center;gap:12px;font-size:clamp(20px,2.5vw,43px);font-weight:800;white-space:nowrap}
.brandmark{width:clamp(45px,5vw,78px);height:auto;flex:none}
.brandline{height:3px;background:#fff;border-radius:50%;width:90%;margin-top:5px;transform:rotate(-5deg)}
.headtitle{text-align:center;border-left:1px solid #426284;border-right:1px solid #426284;padding:0 1vw}
.headtitle strong{display:block;font-size:clamp(24px,3.2vw,52px);line-height:1.05}
.headtitle span{display:block;font-size:clamp(13px,1.6vw,24px);margin-top:8px;color:#d7e5f4}
.clock{text-align:center;font-size:clamp(25px,3vw,48px);font-weight:800}
.clock small{display:block;font-size:clamp(12px,1.3vw,19px);font-weight:500;color:#d7e5f4;margin-top:4px}
.weather{text-align:center;border-left:1px solid #426284;font-size:clamp(24px,3vw,43px)}
.weather small{display:block;font-size:clamp(12px,1.3vw,18px)}
.tvmain{height:69vh;padding:1.8vh 2.8vw 1vh;display:flex;flex-direction:column;gap:1.6vh}
.slide{height:calc(100% - 10vh);min-height:0;display:grid;grid-template-columns:49% 51%;background:#fff;color:var(--ink);border-radius:5px;overflow:hidden}
.photo{background:linear-gradient(135deg,#173b60,#0a2849);min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
.photo img{width:100%;height:100%;object-fit:cover}
.photo .fallback{font-size:clamp(70px,10vw,150px)}
.copy{padding:3.5vh 3vw;display:flex;flex-direction:column;justify-content:center;position:relative}
.pill{align-self:flex-start;background:var(--red);color:white;border-radius:12px;padding:1.2vh 1.5vw;font-size:clamp(18px,2.5vw,38px);font-weight:800;display:flex;align-items:center;gap:.5em}
.copy h1{font-size:clamp(30px,4vw,62px);line-height:1.08;margin:2.2vh 0 1.4vh}
.copy p{font-size:clamp(20px,2.45vw,37px);line-height:1.35;margin:0;white-space:pre-wrap}
.mapmark{position:absolute;right:4%;bottom:5%;font-size:clamp(42px,5vw,75px)}
.ticker{height:8.5vh;min-height:54px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;background:#eaf1fb;color:#101827;border-radius:9px;overflow:hidden}
.tickerlabel{height:100%;display:flex;align-items:center;gap:12px;background:#0755b8;color:white;padding:0 1.5vw;font-size:clamp(17px,2vw,30px);font-weight:800;white-space:nowrap}
.tickertext{padding:0 1.5vw;font-size:clamp(16px,1.8vw,27px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tickericon{padding:0 1.4vw;color:#0755b8;font-size:clamp(24px,3vw,42px)}
.tvfoot{height:9vh;display:flex;align-items:center;justify-content:center;position:relative;color:#c7d7e9;font-size:clamp(12px,1.3vw,18px)}
.dots{display:flex;gap:12px}.dot{width:11px;height:11px;border-radius:50%;background:#8da6c3}.dot.on{background:#fff;box-shadow:0 0 0 3px #7898bd}
.credit{position:absolute;right:3vw}
.adminbody{background:#f3f6fb;color:#122033;min-height:100vh}
.adminwrap{max-width:900px;margin:auto;padding:22px 18px 100px}
.adminhead{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.adminlogo{width:48px;height:48px;border-radius:14px;background:#0755b8;color:white;display:grid;place-items:center;font-size:26px}
.adminhead h1{font-size:23px;margin:0}.adminhead small{color:#64748b}
.quick{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}
.quick button{border:0;border-radius:13px;padding:14px 6px;color:white;font-weight:700;min-height:70px}
.quick .new{background:#0755c5}.quick .gallery{background:#6637c7}.quick .preview{background:#168b48}
.box{background:#fff;border-radius:16px;padding:17px;margin:14px 0;box-shadow:0 3px 14px #102b4b0c}
.box h2{font-size:18px;margin:0 0 14px}
.field{display:block;width:100%;padding:13px;border:1px solid #d4dce7;border-radius:10px;margin:7px 0 13px;background:#fff;color:#111}
label{font-size:14px;font-weight:700;color:#34445a}
.btn{border:0;border-radius:10px;padding:12px 16px;background:#0755b8;color:#fff;font-weight:700;cursor:pointer}
.btn.gray{background:#64748b}.btn.red{background:#c92b48}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.row>*{flex:1}
.postrow{display:grid;grid-template-columns:72px 1fr auto auto;gap:10px;align-items:center;border-bottom:1px solid #e8edf3;padding:11px 0}
.thumb{width:72px;height:58px;object-fit:cover;border-radius:9px;background:#e6edf5}
.postname{font-weight:800;font-size:14px}.postmeta{font-size:12px;color:#64748b;margin-top:5px}
.switch{width:42px;height:24px;accent-color:#169447}
.arrows button{border:0;background:#f0f3f8;border-radius:7px;padding:6px 9px}
.bottomnav{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e3e8ef;display:flex;justify-content:space-around;padding:10px 6px calc(10px + env(safe-area-inset-bottom));z-index:10}
.bottomnav button{border:0;background:transparent;color:#64748b;font-size:12px;display:flex;flex-direction:column;align-items:center;gap:4px}
.bottomnav b{font-size:21px}.bottomnav button.active{color:#0755b8;font-weight:800}
.hide{display:none!important}.muted{color:#64748b;font-size:13px}.status{font-size:13px;color:#167642}
@media(max-width:650px){.tvhead{grid-template-columns:1fr 1fr;height:auto;padding:14px}.headtitle{grid-column:1/-1;grid-row:2;border:0;border-top:1px solid #426284;padding-top:10px}.clock{font-size:24px}.weather{font-size:24px}.tvmain{height:auto;min-height:70vh}.slide{grid-template-columns:1fr;grid-template-rows:30vh auto}.copy{padding:22px}.copy h1{font-size:30px}.copy p{font-size:19px}.ticker{grid-template-columns:1fr;height:auto;min-height:80px}.tickerlabel{padding:10px}.tickericon{display:none}.tvfoot{height:55px}}
`;

function logoSVG(){return `<svg class="brandmark" viewBox="0 0 110 70" aria-hidden="true"><path d="M18 43V20Q18 7 31 7h43q13 0 13 13v23" fill="none" stroke="white" stroke-width="5"/><path d="M29 37V22q0-7 7-7h33q7 0 7 7v15z" fill="white"/><path d="M10 44h90l-13 12H23z" fill="white"/><path d="M5 65Q45 51 105 62" fill="none" stroke="white" stroke-width="3"/></svg>`}
function screenPage(){return `<!doctype html><html lang="sv"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lysekil Buss | Tanum InfoScreen</title><style>${sharedCSS}</style><body class="screen"><header class="tvhead"><div><div class="brand">${logoSVG()}<span>Lysekil Buss<div class="brandline"></div></span></div></div><div class="headtitle"><strong>Tanum InfoScreen</strong><span>Information för våra förare</span></div><div class="clock"><span id="time">--:--</span><small id="date">--</small></div><div class="weather">☁<small id="temp">--°C</small></div></header><main class="tvmain"><section class="slide"><div class="photo" id="photo"><div class="fallback">🚌</div></div><div class="copy"><div class="pill"><span id="emoji">⚠️</span><span id="category">INFORMATION</span></div><h1 id="title">Välkommen</h1><p id="message">Information för våra förare visas här.</p><div class="mapmark" id="mapmark"></div></div></section><section class="ticker"><div class="tickerlabel"><span id="tickemoji">▣</span><span id="ticktitle">Information</span></div><div class="tickertext" id="ticktext">Viktig information för våra förare visas här.</div><div class="tickericon">👥</div></section></main><footer class="tvfoot"><div class="dots" id="dots"><i class="dot on"></i><i class="dot"></i><i class="dot"></i></div><div class="credit">Designed by Ahmad Kassab</div></footer><script>
const $=id=>document.getElementById(id);let posts=[],index=0,rotation=null,tickerIndex=0;
const emojis={"VÄGARBETE":"⚠️","APT-MÖTE":"▣","SÄKERHET":"❄️","INFORMATION":"ℹ️","VIKTIGT":"❗","TRAFIK":"🚌","DRIFT":"🔧","PÅMINNELSE":"📅"};
function updateClock(){const d=new Date();$("time").textContent=d.toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"});$("date").textContent=d.toLocaleDateString("sv-SE",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}
function updateDots(){const count=Math.max(1,posts.length);$("dots").innerHTML=Array.from({length:count},(_,i)=>'<i class="dot '+(i===index?'on':'')+'"></i>').join("")}
function show(){if(!posts.length){$("category").textContent="INFORMATION";$("title").textContent="Välkommen";$("message").textContent="Information för våra förare visas här.";$("photo").innerHTML='<div class="fallback">🚌</div>';$("ticktitle").textContent="Information";$("ticktext").textContent="Viktig information för våra förare visas här.";updateDots();return}
const p=posts[index%posts.length],cat=(p.category||"INFORMATION").toUpperCase();$("category").textContent=cat;$("emoji").textContent=emojis[cat]||"ℹ️";$("title").textContent=p.title;$("message").textContent=p.message;$("photo").innerHTML=p.image?'<img src="'+p.image+'" alt="">':'<div class="fallback">🚌</div>';$("ticktitle").textContent=p.footerTitle||"Information";$("ticktext").textContent=p.footer||"Information för våra förare";$("tickemoji").textContent=emojis[cat]||"▣";updateDots();clearTimeout(rotation);rotation=setTimeout(()=>{index=(index+1)%posts.length;show()},Math.max(15,Number(p.duration)||120)*1000)}
async function refresh(){try{const r=await fetch("/api/posts",{cache:"no-store"});if(r.ok){posts=await r.json();if(index>=posts.length)index=0;show()}}catch(e){}}
async function weather(){try{const r=await fetch("/api/weather");const d=await r.json();if(d.temp!==null)$("temp").textContent=d.temp+"°C"}catch(e){}}
updateClock();setInterval(updateClock,1000);refresh();weather();setInterval(refresh,20000);setInterval(weather,900000);
</script></body></html>`}

function adminPage(){return `<!doctype html><html lang="sv"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><title>Admin – Tanum InfoScreen</title><style>${sharedCSS}</style><body class="adminbody"><main class="adminwrap"><header class="adminhead"><div class="adminlogo">🚌</div><div><h1>Tanum InfoScreen</h1><small>Administratör · Lysekil Buss</small></div></header><section id="login" class="box"><h2>Administratörsinloggning</h2><input id="pin" class="field" type="password" inputmode="numeric" placeholder="Ange PIN-kod"><button class="btn" onclick="login()">Logga in</button><p id="loginerr" class="muted"></p><p class="muted">Standardkod: 2468 (byt gärna via Worker-variabeln ADMIN_PIN).</p></section><section id="app" class="hide"><div class="quick"><button class="new" onclick="newPost()">＋<br>Nytt inlägg</button><button class="gallery" onclick="document.getElementById('imageFile').click()">▧<br>Bild / Galleri</button><button class="preview" onclick="window.open('/','_blank')">◉<br>Förhandsvisa</button></div><section class="box" id="editor"><h2 id="editorTitle">Nytt inlägg</h2><input id="pid" type="hidden"><label>Rubrik</label><input id="title" class="field" maxlength="100" placeholder="Exempel: Vägarbete – Väg 164"><label>Kategori</label><select id="category" class="field"><option>INFORMATION</option><option>VÄGARBETE</option><option>APT-MÖTE</option><option>SÄKERHET</option><option>VIKTIGT</option><option>TRAFIK</option><option>DRIFT</option><option>PÅMINNELSE</option></select><label>Meddelande</label><textarea id="message" class="field" rows="4" placeholder="Skriv informationen som ska visas på TV:n..."></textarea><label>Bild (valfritt)</label><input id="imageFile" class="field" type="file" accept="image/jpeg,image/png,image/webp"><input id="image" type="hidden"><div class="row"><div><label>Visningstid</label><select id="duration" class="field"><option value="60">1 minut</option><option value="120" selected>2 minuter</option><option value="180">3 minuter</option><option value="300">5 minuter</option></select></div><div><label>Publicera från</label><input id="startAt" class="field" type="datetime-local"></div></div><label>Avpublicera efter (valfritt)</label><input id="endAt" class="field" type="datetime-local"><label>Text i nedre informationsfältet (valfritt)</label><input id="footer" class="field" maxlength="160" placeholder="Exempel: APT på måndag kl. 09:00 i mötesrummet"><label><input id="paused" type="checkbox"> Pausa inlägget</label><div class="row"><button class="btn" onclick="savePost()">Spara inlägg</button><button class="btn gray" onclick="clearForm()">Avbryt</button></div><p id="status" class="muted"></p></section><section class="box"><h2>Publicerade inlägg (<span id="count">0</span>)</h2><div id="posts">Laddar...</div></section></section><div class="muted" style="text-align:center;padding:18px">Designed by Ahmad Kassab</div></main><nav class="bottomnav" id="nav"><button class="active" onclick="tab('posts',this)"><b>▣</b>Inlägg</button><button onclick="window.open('/','_blank')"><b>▤</b>Schema</button><button onclick="tab('settings',this)"><b>⚙</b>Inställningar</button><button onclick="logout()"><b>⇥</b>Logga ut</button></nav><script>
let token="",items=[];const $=id=>document.getElementById(id);
async function login(){const r=await fetch("/api/admin/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({pin:$("pin").value})});const d=await r.json();if(!r.ok){$("loginerr").textContent=d.error||"Fel kod";return}token=d.token;$("login").classList.add("hide");$("app").classList.remove("hide");load()}
async function api(path,opts={}){return fetch(path,{...opts,headers:{...(opts.headers||{}),authorization:"Bearer "+token,"content-type":"application/json"}})}
async function load(){const r=await api("/api/admin/posts");if(!r.ok){logout();return}items=await r.json();$("count").textContent=items.length;$("posts").innerHTML=items.length?items.map((p,i)=>'<div class="postrow"><img class="thumb" src="'+(p.image||'')+'" onerror="this.style.opacity=.15" alt=""><div><div class="postname">'+esc(p.title)+'</div><div class="postmeta">'+esc(p.category)+' · '+Math.round(p.duration/60)+' min · '+(p.paused?'Pausat':'Publicerat')+'</div></div><input class="switch" type="checkbox" '+(!p.paused?'checked':'')+' onchange="togglePost(\\''+p.id+'\\',this.checked)" aria-label="Visa inlägg"><div class="arrows"><button onclick="move(\\''+p.id+'\\',-1)">☰↑</button><button onclick="editPost(\\''+p.id+'\\')">✎</button><button onclick="removePost(\\''+p.id+'\\')">×</button></div></div>').join(""):'<p class="muted">Inga inlägg ännu. Tryck på Nytt inlägg.</p>'}
function esc(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function newPost(){clearForm();$("editor").scrollIntoView({behavior:"smooth"})}
function clearForm(){["pid","title","message","image","startAt","endAt","footer"].forEach(x=>$(x).value="");$("duration").value="120";$("paused").checked=false;$("imageFile").value="";$("editorTitle").textContent="Nytt inlägg";$("status").textContent=""}
function editPost(id){const p=items.find(x=>x.id===id);if(!p)return;$("pid").value=p.id;$("title").value=p.title;$("category").value=p.category;$("message").value=p.message;$("image").value=p.image||"";$("duration").value=String(p.duration||120);$("startAt").value=p.startAt||"";$("endAt").value=p.endAt||"";$("footer").value=p.footer||"";$("paused").checked=!!p.paused;$("editorTitle").textContent="Ändra inlägg";$("editor").scrollIntoView({behavior:"smooth"})}
async function compress(file){return new Promise((resolve,reject)=>{const img=new Image(),reader=new FileReader();reader.onerror=reject;reader.onload=()=>{img.onload=()=>{const scale=Math.min(1,1500/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext("2d").drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.78))};img.onerror=reject;img.src=reader.result};reader.readAsDataURL(file)})}
async function savePost(){try{$("status").textContent="Sparar...";let image=$("image").value;const f=$("imageFile").files[0];if(f){const data=await compress(f);const ir=await api("/api/admin/image",{method:"POST",body:JSON.stringify({data})});const id=await ir.json();if(!ir.ok)throw Error(id.error);image=id.image}const body={id:$("pid").value,title:$("title").value,category:$("category").value,message:$("message").value,image,duration:$("duration").value,startAt:$("startAt").value,endAt:$("endAt").value,footer:$("footer").value,paused:$("paused").checked};const r=await api("/api/admin/posts",{method:"POST",body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);$("status").textContent="Sparat! TV-skärmen uppdateras automatiskt.";clearForm();await load()}catch(e){$("status").textContent=e.message||"Något gick fel."}}
async function togglePost(id,active){const p=items.find(x=>x.id===id);if(!p)return;p.paused=!active;await api("/api/admin/posts",{method:"POST",body:JSON.stringify(p)});load()}
async function removePost(id){if(!confirm("Vill du ta bort inlägget?"))return;await api("/api/admin/posts/"+id,{method:"DELETE"});load()}
async function move(id,dir){const i=items.findIndex(p=>p.id===id),j=i+dir;if(j<0||j>=items.length)return;[items[i],items[j]]=[items[j],items[i]];await api("/api/admin/order",{method:"POST",body:JSON.stringify({ids:items.map(p=>p.id)})});load()}
function tab(name,button){document.querySelectorAll(".bottomnav button").forEach(b=>b.classList.remove("active"));button.classList.add("active");if(name==="settings")alert("Inställningar: byt administratörskod genom att lägga till Worker-variabeln ADMIN_PIN i Cloudflare.");else $("editor").scrollIntoView({behavior:"smooth"})}
function logout(){token="";$("app").classList.add("hide");$("login").classList.remove("hide");$("pin").value=""}
</script></body></html>`}
