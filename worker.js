const DEFAULT_POSTS = [
  {
    id: "welcome",
    title: "Välkommen till Tanum",
    text: "Här visas viktig information för dig som förare.",
    category: "Information",
    image: "",
    duration: 60,
    enabled: true,
    updatedAt: new Date().toISOString()
  }
];

function html() {
return `<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tanum InfoScreen</title>
<style>
:root{--navy:#102b46;--blue:#1769aa;--gold:#e6bd55;--bg:#eef2f5}
*{box-sizing:border-box}body{margin:0;font-family:Arial, sans-serif;background:var(--bg);color:#172331}
header{background:var(--navy);color:white;padding:16px 22px;display:flex;justify-content:space-between;align-items:center}
.brand{font-size:clamp(20px,3vw,34px);font-weight:800;letter-spacing:.3px}.sub{opacity:.8;font-size:14px;margin-top:4px}
main{max-width:1250px;margin:22px auto;padding:0 18px}
.screen{background:#fff;border-radius:22px;overflow:hidden;min-height:65vh;display:grid;grid-template-columns:1.1fr .9fr;box-shadow:0 8px 30px #102b4618}
.photo{background:linear-gradient(135deg,#dce8ef,#b9cbd8);min-height:420px;display:flex;align-items:center;justify-content:center;color:#486174;font-size:80px}
.photo img{width:100%;height:100%;object-fit:cover;max-height:70vh}
.content{padding:clamp(24px,4vw,58px);display:flex;flex-direction:column;justify-content:center}
.tag{color:var(--blue);font-weight:800;text-transform:uppercase;letter-spacing:2px;font-size:14px}
h1{font-size:clamp(30px,4.5vw,58px);line-height:1.05;margin:18px 0}
.message{font-size:clamp(18px,2vw,25px);line-height:1.5;color:#435466;white-space:pre-wrap}
.meta{margin-top:28px;color:#748391;font-size:14px}
footer{display:flex;justify-content:space-between;align-items:center;padding:14px 4px;color:#6c7a87;font-size:13px}
.dots{display:flex;gap:7px}.dot{width:8px;height:8px;border-radius:50%;background:#c4cdd5}.dot.on{background:var(--blue)}
.admin{margin:28px 0;background:white;border-radius:16px;padding:20px;box-shadow:0 4px 18px #102b4610}
input,textarea,select{width:100%;padding:12px;border:1px solid #ccd5dd;border-radius:9px;font:inherit;margin:6px 0 12px}
textarea{min-height:90px}button{border:0;border-radius:9px;padding:12px 17px;background:var(--blue);color:white;font-weight:700;font-size:15px;margin:4px 5px 4px 0}
button.secondary{background:#e8edf1;color:#203447}button.danger{background:#a93636}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.post{border:1px solid #dce2e7;padding:12px;border-radius:10px;margin:8px 0;display:flex;justify-content:space-between;gap:10px}
.small{font-size:13px;color:#657482}
@media(max-width:720px){.screen{grid-template-columns:1fr}.photo{min-height:240px;max-height:34vh}.content{padding:25px}.row{grid-template-columns:1fr}}
</style></head><body>
<header><div><div class="brand">LYSEKIL BUSS <span style="color:var(--gold)">|</span> TANUM INFOSCREEN</div><div class="sub">Förarinformation · Tanum</div></div><button class="secondary" onclick="toggleAdmin()">Admin</button></header>
<main>
<section class="screen" id="screen"><div class="photo" id="photo">🚌</div><div class="content"><div class="tag" id="category">Information</div><h1 id="title">Välkommen till Tanum</h1><div class="message" id="message">Här visas viktig information för dig som förare.</div><div class="meta" id="meta">Lysekil Buss · Tanum</div></div></section>
<footer><span>Designed by Ahmad Kassab</span><div class="dots" id="dots"></div><span id="counter"></span></footer>
<section class="admin" id="admin" hidden>
<h2>Administrera information</h2><p class="small">Logga in med administratörskoden för att lägga till och ändra meddelanden. Ändringar sparas på servern när KV-kopplingen är aktiverad.</p>
<div id="login"><label>Administratörskod</label><input id="pin" type="password" placeholder="Ange kod"><button onclick="login()">Logga in</button><span id="loginMsg" class="small"></span></div>
<div id="editor" hidden>
<label>Rubrik</label><input id="fTitle" placeholder="Exempel: Vägarbete på väg 163">
<label>Kategori</label><select id="fCategory"><option>Information</option><option>Vägarbete</option><option>Viktigt meddelande</option><option>APT</option><option>Bussinformation</option></select>
<label>Meddelande</label><textarea id="fText" placeholder="Skriv informationen på svenska..."></textarea>
<label>Bildlänk (valfritt)</label><input id="fImage" type="url" placeholder="https://...">
<div class="row"><div><label>Visningstid (sekunder)</label><input id="fDuration" type="number" min="10" max="600" value="60"></div><div><label>Visa inlägget</label><select id="fEnabled"><option value="true">Ja</option><option value="false">Nej</option></select></div></div>
<button onclick="savePost()">Spara inlägg</button><button class="secondary" onclick="clearForm()">Rensa formulär</button><h3>Publicerade inlägg</h3><div id="postList"></div>
</div></section>
</main>
<script>
let posts=[],index=0,timer=null,adminToken="";
const $=id=>document.getElementById(id);
async function api(path,opts={}){let r=await fetch(path,{...opts,headers:{"Content-Type":"application/json","Authorization":adminToken?`Bearer ${adminToken}`:"",...(opts.headers||{})}});let d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Något gick fel");return d}
async function load(){try{let d=await api("/api/posts");posts=(d.posts||[]).filter(p=>p.enabled);if(!posts.length)posts=[{...${JSON.stringify(DEFAULT_POSTS[0])}}];render();}catch(e){$("title").textContent="Kan inte hämta information";$("message").textContent=e.message;}}
function render(){if(!posts.length)return;index=index%posts.length;let p=posts[index];$("category").textContent=p.category||"Information";$("title").textContent=p.title||"";$("message").textContent=p.text||"";$("meta").textContent="Lysekil Buss · Tanum";$("photo").innerHTML=p.image?`<img src="${esc(p.image)}" alt="">`:"🚌";$("dots").innerHTML=posts.map((_,i)=>`<span class="dot ${i===index?"on":""}"></span>`).join("");$("counter").textContent=`${index+1} / ${posts.length}`;clearTimeout(timer);timer=setTimeout(()=>{index=(index+1)%posts.length;render()},Math.max(10,Number(p.duration)||60)*1000)}
function esc(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toggleAdmin(){$("admin").hidden=!$("admin").hidden}
async function login(){try{adminToken=$("pin").value;await api("/api/posts");$("login").hidden=true;$("editor").hidden=false;await refreshList()}catch(e){$("loginMsg").textContent="Fel kod eller serverinställning saknas.";adminToken=""}}
async function refreshList(){let d=await api("/api/all");posts=d.posts||[];$("postList").innerHTML=posts.map(p=>`<div class="post"><div><b>${esc(p.title)}</b><div class="small">${esc(p.category)} · ${p.enabled?"Aktiv":"Pausad"}</div></div><div><button class="secondary" onclick="editPost('${p.id}')">Ändra</button><button class="danger" onclick="deletePost('${p.id}')">Ta bort</button></div></div>`).join("");let active=posts.filter(p=>p.enabled);if(active.length){posts=active;index=0;render()}}
function clearForm(){["fTitle","fText","fImage"].forEach(id=>$(id).value="");$("fDuration").value=60;$("fEnabled").value="true";$("fCategory").value="Information";$("fTitle").dataset.id=""}
async function savePost(){let p={id:$("fTitle").dataset.id||crypto.randomUUID(),title:$("fTitle").value.trim(),category:$("fCategory").value,text:$("fText").value.trim(),image:$("fImage").value.trim(),duration:Math.min(600,Math.max(10,Number($("fDuration").value)||60)),enabled:$("fEnabled").value==="true"};if(!p.title||!p.text){alert("Fyll i rubrik och meddelande.");return}try{await api("/api/posts",{method:"PUT",body:JSON.stringify({post:p})});clearForm();await refreshList()}catch(e){alert(e.message)}}
async function editPost(id){let p=posts.find(x=>x.id===id);if(!p)return;$("fTitle").value=p.title;$("fTitle").dataset.id=p.id;$("fCategory").value=p.category;$("fText").value=p.text;$("fImage").value=p.image||"";$("fDuration").value=p.duration||60;$("fEnabled").value=String(p.enabled)}
async function deletePost(id){if(!confirm("Ta bort inlägget?"))return;try{await api("/api/posts",{method:"DELETE",body:JSON.stringify({id})});await refreshList()}catch(e){alert(e.message)}}
load();setInterval(load,30000);
</script></body></html>`;
}

export default {
 async fetch(request, env) {
  const url = new URL(request.url);
  const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,PUT,DELETE,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization"};
  if(request.method==="OPTIONS") return new Response(null,{headers:cors});
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...cors}});
  if(url.pathname==="/" || url.pathname==="/index.html") return new Response(html(),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
  if(url.pathname.startsWith("/api/")){
   if(!env.INFO_KV) return json({error:"INFO_KV saknas. Skapa och koppla en KV-namespace med namnet INFO_KV."},500);
   const key="posts";
   let posts=await env.INFO_KV.get(key,"json")||DEFAULT_POSTS;
   if(url.pathname==="/api/posts" && request.method==="GET") return json({posts:posts.filter(p=>p.enabled)});
   const auth=request.headers.get("Authorization")||"";
   if(!env.ADMIN_PIN || auth!=="Bearer "+env.ADMIN_PIN) return json({error:"Otillåten åtkomst"},401);
   if(url.pathname==="/api/all" && request.method==="GET") return json({posts});
   if(url.pathname==="/api/posts" && request.method==="PUT"){let body=await request.json();let p=body.post;if(!p||!p.id||!p.title||!p.text)return json({error:"Ogiltigt inlägg"},400);let i=posts.findIndex(x=>x.id===p.id);if(i<0)posts.push(p);else posts[i]=p;await env.INFO_KV.put(key,JSON.stringify(posts));return json({ok:true})}
   if(url.pathname==="/api/posts" && request.method==="DELETE"){let body=await request.json();posts=posts.filter(p=>p.id!==body.id);await env.INFO_KV.put(key,JSON.stringify(posts));return json({ok:true})}
  }
  return json({error:"Not found"},404);
 }
};
