const STORE_KEY = "tanum_infoscreen_posts_v1";
const MAX_IMAGE_BYTES = 500 * 1024; // 500 KB per image
const MAX_POSTS = 40;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (path === "/" || path === "/display") {
      return html(displayPage(), "Tanum InfoScreen");
    }
    if (path === "/admin") {
      return html(adminPage(), "Tanum InfoScreen – Admin");
    }

    if (path === "/api/posts" && request.method === "GET") {
      const posts = await readPosts(env);
      const now = Date.now();
      const visible = posts
        .filter(p => p.enabled !== false)
        .filter(p => !p.startAt || new Date(p.startAt).getTime() <= now)
        .filter(p => !p.endAt || new Date(p.endAt).getTime() > now)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      return json({ posts: visible });
    }

    if (path.startsWith("/api/admin/")) {
      if (!isAuthorized(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      if (path === "/api/admin/posts" && request.method === "GET") {
        return json({ posts: await readPosts(env) });
      }

      if (path === "/api/admin/posts" && request.method === "PUT") {
        let body;
        try { body = await request.json(); } catch { return json({ error: "Ogiltig JSON" }, 400); }
        if (!Array.isArray(body.posts)) return json({ error: "posts måste vara en lista" }, 400);
        if (body.posts.length > MAX_POSTS) return json({ error: `Max ${MAX_POSTS} inlägg` }, 400);

        const clean = [];
        for (let i = 0; i < body.posts.length; i++) {
          const p = body.posts[i] || {};
          const image = typeof p.image === "string" ? p.image : "";
          if (image.length > Math.ceil(MAX_IMAGE_BYTES * 1.4) + 100) {
            return json({ error: "Bilden är för stor. Välj en bild under 500 KB." }, 413);
          }
          clean.push({
            id: String(p.id || crypto.randomUUID()),
            title: String(p.title || "Information").slice(0, 100),
            message: String(p.message || "").slice(0, 1200),
            image,
            duration: Math.max(10, Math.min(300, Number(p.duration) || 30)),
            enabled: p.enabled !== false,
            startAt: p.startAt ? String(p.startAt) : "",
            endAt: p.endAt ? String(p.endAt) : "",
            order: i
          });
        }
        await env.INFO_KV.put(STORE_KEY, JSON.stringify(clean));
        return json({ ok: true, posts: clean });
      }
      return json({ error: "Not found" }, 404);
    }

    return new Response("Not found", { status: 404 });
  }
};

async function readPosts(env) {
  if (!env.INFO_KV) return [];
  try { return JSON.parse(await env.INFO_KV.get(STORE_KEY) || "[]"); }
  catch { return []; }
}

function isAuthorized(request, env) {
  const configured = env.ADMIN_PIN;
  const supplied = request.headers.get("x-admin-pin") || "";
  return !!configured && supplied === configured;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Pin"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(),
      "Cache-Control": "no-store" }
  });
}

function html(body, title) {
  return new Response(body.replaceAll("__PAGE_TITLE__", title), {
    headers: { "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff" }
  });
}

function sharedCss() {
  return `
  *{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f3f6fb;color:#172033}
  button,input,textarea{font:inherit}button{cursor:pointer;border:0;border-radius:10px;padding:12px 16px;font-weight:700}
  .primary{background:#075bd8;color:#fff}.secondary{background:#e8eef8;color:#17345f}.danger{background:#fee8e7;color:#a3211b}
  .muted{color:#667085}.top{background:#082b55;color:white;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px}
  .brand{font-weight:800;font-size:22px}.wrap{max-width:1000px;margin:24px auto;padding:0 16px}
  .panel{background:white;border:1px solid #e1e7f0;border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:0 4px 16px #122b4a0a}
  .field{display:grid;gap:7px;margin:12px 0}.field label{font-weight:700;font-size:14px}
  input,textarea{width:100%;border:1px solid #cfd8e6;border-radius:10px;padding:12px;background:#fff;color:#172033}
  textarea{min-height:110px;resize:vertical}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .row>*{flex:1}.post{display:flex;gap:14px;align-items:center;border:1px solid #e6ebf2;border-radius:12px;padding:12px;margin:10px 0}
  .thumb{width:86px;height:66px;object-fit:cover;border-radius:8px;background:#e9eef5}.postinfo{flex:1;min-width:0}
  .postinfo strong{display:block}.postinfo p{margin:5px 0;color:#667085;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tag{display:inline-block;background:#eaf2ff;color:#075bd8;padding:4px 8px;border-radius:20px;font-size:12px}
  .hidden{display:none!important}.hint{font-size:13px;color:#667085;line-height:1.5}
  `;
}

function displayPage() {
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>__PAGE_TITLE__</title>
  <style>
  ${sharedCss()}
  html,body{width:100%;height:100%;overflow:hidden;background:#071d38;color:white}
  .screen{height:100vh;display:flex;flex-direction:column;background:linear-gradient(135deg,#082b55,#06172d)}
  .head{display:flex;align-items:center;justify-content:space-between;padding:2.2vh 3vw;border-bottom:2px solid #ffffff22;gap:20px}
  .logo{font-size:clamp(22px,3vw,48px);font-weight:800}.subtitle{font-size:clamp(13px,1.5vw,24px);color:#c7dcf5;margin-top:5px}
  .clock{text-align:right;font-size:clamp(20px,2.8vw,42px);font-weight:700}.date{font-size:clamp(12px,1.3vw,20px);color:#c7dcf5}
  .content{flex:1;display:flex;align-items:stretch;gap:2vw;padding:2.5vh 3vw;min-height:0}
  .visual{flex:1.1;min-width:0;display:flex;align-items:center;justify-content:center;background:#ffffff0c;border-radius:18px;overflow:hidden}
  .visual img{width:100%;height:100%;object-fit:cover}.visual .placeholder{font-size:clamp(60px,10vw,150px)}
  .info{flex:1;min-width:0;background:#fff;color:#101828;border-radius:18px;padding:3vw;display:flex;flex-direction:column;justify-content:center}
  .label{display:inline-block;background:#e11d48;color:white;font-size:clamp(15px,1.6vw,26px);font-weight:800;padding:10px 16px;border-radius:9px;align-self:flex-start;margin-bottom:2vh}
  h1{font-size:clamp(28px,4vw,62px);line-height:1.08;margin:0 0 2vh}.message{font-size:clamp(19px,2.3vw,36px);line-height:1.35;white-space:pre-wrap}
  .ticker{margin:0 3vw 2vh;background:#0d5ac5;border-radius:12px;padding:1.5vh 2vw;font-size:clamp(16px,1.8vw,28px);display:flex;gap:14px;align-items:center}
  .foot{padding:0 3vw 1.5vh;display:flex;justify-content:space-between;color:#b9d1ed;font-size:clamp(11px,1.1vw,16px)}
  @media(max-aspect-ratio:1/1){.content{flex-direction:column}.visual{min-height:25vh}.info{padding:5vw}.head{padding:16px}.ticker{margin-bottom:10px}}
  </style></head><body><main class="screen">
  <header class="head"><div><div class="logo">🚌 Lysekil Buss</div><div class="subtitle">Tanum InfoScreen · Information för våra förare</div></div>
  <div class="clock"><span id="clock">--:--</span><div class="date" id="date"></div></div></header>
  <section class="content"><div class="visual" id="visual"><div class="placeholder">🚌</div></div>
  <article class="info"><div class="label" id="label">INFORMATION</div><h1 id="title">Välkommen</h1><div class="message" id="message">Information för våra förare visas här.</div></article></section>
  <div class="ticker"><strong>INFORMATION</strong><span id="ticker">Välkommen till Tanum InfoScreen</span></div>
  <footer class="foot"><span>Lysekil Buss</span><span>Designad av Ahmad Kassab</span></footer></main>
  <script>
  let items=[],index=0,timer=null;
  const el=id=>document.getElementById(id);
  function updateClock(){const d=new Date();el('clock').textContent=d.toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});el('date').textContent=d.toLocaleDateString('sv-SE',{weekday:'long',year:'numeric',month:'long',day:'numeric'});}
  function show(){if(!items.length){el('title').textContent='Välkommen';el('message').textContent='Information för våra förare visas här.';el('visual').innerHTML='<div class="placeholder">🚌</div>';return;}
    const p=items[index%items.length];el('label').textContent='INFORMATION';el('title').textContent=p.title||'Information';el('message').textContent=p.message||'';
    el('ticker').textContent=(p.title||'Information')+' – '+(p.message||'');
    el('visual').innerHTML=p.image?'<img alt="" src="'+p.image+'">':'<div class="placeholder">🚌</div>';
    clearTimeout(timer);timer=setTimeout(()=>{index=(index+1)%items.length;show();},(Number(p.duration)||30)*1000);
  }
  async function load(){try{const r=await fetch('/api/posts',{cache:'no-store'});const d=await r.json();const signature=JSON.stringify(d.posts||[]);if(signature!==window.lastSignature){window.lastSignature=signature;items=d.posts||[];index=0;show();}}catch(e){}}
  updateClock();setInterval(updateClock,1000);load();setInterval(load,15000);
  </script></body></html>`;
}

function adminPage() {
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>__PAGE_TITLE__</title><style>
  ${sharedCss()}
  .login{max-width:440px;margin:8vh auto}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions button{flex:1}
  .post button{padding:9px 11px}.status{font-size:13px;margin-top:10px}.preview{max-width:100%;max-height:180px;border-radius:10px}
  </style></head><body><header class="top"><div><div class="brand">🚌 Tanum InfoScreen</div><div class="hint" style="color:#c7dcf5">Administratör</div></div><a href="/display" style="color:white">Visa TV-skärmen ↗</a></header>
  <main class="wrap">
  <section class="panel login" id="login"><h2>Logga in</h2><p class="muted">Ange administratörskoden.</p><div class="field"><label>Administratörskod</label><input id="pin" type="password" inputmode="numeric" placeholder="Kod"></div><button class="primary" id="loginBtn">Logga in</button><div class="status" id="loginStatus"></div></section>
  <div id="app" class="hidden">
    <section class="panel"><div class="row"><div><h2 style="margin:0">Publicerade inlägg</h2><p class="muted">Lägg till information som visas automatiskt på TV-skärmen.</p></div><button class="primary" id="newBtn">＋ Nytt inlägg</button></div><div id="posts"></div></section>
    <section class="panel hidden" id="editor"><h2 id="editorTitle">Nytt inlägg</h2><input type="hidden" id="postId">
      <div class="field"><label>Rubrik</label><input id="title" maxlength="100" placeholder="Exempel: Vägarbete – Väg 164"></div>
      <div class="field"><label>Meddelande</label><textarea id="message" maxlength="1200" placeholder="Skriv information till förarna..."></textarea></div>
      <div class="field"><label>Bild (valfritt, max 500 KB)</label><input id="imageFile" type="file" accept="image/*"><img id="imagePreview" class="preview hidden" alt="Förhandsvisning"><button class="secondary hidden" id="removeImage" type="button">Ta bort bild</button></div>
      <div class="row"><div class="field"><label>Visningstid (sekunder)</label><input id="duration" type="number" min="10" max="300" value="30"></div><div class="field"><label>Starta visning (valfritt)</label><input id="startAt" type="datetime-local"></div></div>
      <div class="field"><label>Sluta visa efter (valfritt)</label><input id="endAt" type="datetime-local"></div>
      <div class="field"><label><input id="enabled" type="checkbox" checked style="width:auto"> Aktivt inlägg</label></div>
      <div class="actions"><button class="primary" id="saveBtn">Spara inlägg</button><button class="secondary" id="cancelBtn">Avbryt</button></div><div class="status" id="editorStatus"></div>
    </section>
    <p class="hint">Tips: använd korta meddelanden och tydliga bilder. För bästa resultat bör bilder vara under 500 KB.</p>
  </div></main>
  <script>
  let pin='',posts=[],imageData='';
  const $=id=>document.getElementById(id);
  async function api(method='GET',body){const r=await fetch('/api/admin/posts',{method,headers:{'Content-Type':'application/json','X-Admin-Pin':pin},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw new Error(d.error||'Fel');return d;}
  $('loginBtn').onclick=async()=>{pin=$('pin').value;try{await loadPosts();$('login').classList.add('hidden');$('app').classList.remove('hidden');}catch(e){$('loginStatus').textContent='Fel kod eller anslutningsproblem.';}};
  $('pin').addEventListener('keydown',e=>{if(e.key==='Enter')$('loginBtn').click();});
  async function loadPosts(){const d=await api();posts=d.posts||[];render();}
  function render(){const root=$('posts');root.innerHTML='';if(!posts.length){root.innerHTML='<p class="muted">Inga inlägg ännu. Tryck på ”Nytt inlägg”.</p>';return;}
    posts.sort((a,b)=>(a.order||0)-(b.order||0)).forEach((p,i)=>{const row=document.createElement('div');row.className='post';
      const img=document.createElement('img');img.className='thumb';img.src=p.image||'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="90" height="66"><rect width="100%" height="100%" fill="#e9eef5"/><text x="50%" y="55%" text-anchor="middle" font-size="28">🚌</text></svg>');
      const info=document.createElement('div');info.className='postinfo';const strong=document.createElement('strong');strong.textContent=p.title;const desc=document.createElement('p');desc.textContent=p.message;const tag=document.createElement('span');tag.className='tag';tag.textContent=(p.enabled?'Aktivt':'Pausat')+' · '+p.duration+' sek';info.append(strong,desc,tag);
      const up=makeBtn('↑','secondary',()=>move(i,-1));const down=makeBtn('↓','secondary',()=>move(i,1));const edit=makeBtn('Redigera','secondary',()=>editPost(p));const del=makeBtn('Ta bort','danger',()=>deletePost(p.id));row.append(img,info,up,down,edit,del);root.append(row);
    });
  }
  function makeBtn(text,cls,fn){const b=document.createElement('button');b.textContent=text;b.className=cls;b.onclick=fn;return b;}
  function openEditor(){ $('editor').classList.remove('hidden');$('editor').scrollIntoView({behavior:'smooth'});}
  $('newBtn').onclick=()=>{resetEditor();openEditor();};
  $('cancelBtn').onclick=()=>{$('editor').classList.add('hidden');};
  function resetEditor(){ $('postId').value='';$('title').value='';$('message').value='';$('duration').value=30;$('startAt').value='';$('endAt').value='';$('enabled').checked=true;imageData='';$('imageFile').value='';$('imagePreview').classList.add('hidden');$('removeImage').classList.add('hidden');$('editorTitle').textContent='Nytt inlägg';$('editorStatus').textContent='';}
  function editPost(p){$('postId').value=p.id;$('title').value=p.title;$('message').value=p.message;$('duration').value=p.duration;$('startAt').value=p.startAt||'';$('endAt').value=p.endAt||'';$('enabled').checked=p.enabled!==false;imageData=p.image||'';preview();$('editorTitle').textContent='Redigera inlägg';openEditor();}
  function preview(){if(imageData){$('imagePreview').src=imageData;$('imagePreview').classList.remove('hidden');$('removeImage').classList.remove('hidden');}else{$('imagePreview').classList.add('hidden');$('removeImage').classList.add('hidden');}}
  $('imageFile').onchange=()=>{const f=$('imageFile').files[0];if(!f)return;if(f.size>512000){$('editorStatus').textContent='Bilden är större än 500 KB. Välj en mindre bild.';$('imageFile').value='';return;}const reader=new FileReader();reader.onload=()=>{imageData=reader.result;preview();};reader.readAsDataURL(f);};
  $('removeImage').onclick=()=>{imageData='';$('imageFile').value='';preview();};
  $('saveBtn').onclick=async()=>{try{const id=$('postId').value||crypto.randomUUID();const post={id,title:$('title').value.trim(),message:$('message').value.trim(),image:imageData,duration:Number($('duration').value)||30,enabled:$('enabled').checked,startAt:$('startAt').value,endAt:$('endAt').value};if(!post.title){$('editorStatus').textContent='Skriv en rubrik först.';return;}const idx=posts.findIndex(p=>p.id===id);if(idx>=0)posts[idx]=post;else posts.push(post);await api('PUT',{posts});await loadPosts();$('editor').classList.add('hidden');}catch(e){$('editorStatus').textContent='Kunde inte spara: '+e.message;}};
  async function move(i,delta){const j=i+delta;if(j<0||j>=posts.length)return;[posts[i],posts[j]]=[posts[j],posts[i]];try{await api('PUT',{posts});await loadPosts();}catch(e){alert(e.message);}}
  async function deletePost(id){if(!confirm('Ta bort inlägget?'))return;posts=posts.filter(p=>p.id!==id);try{await api('PUT',{posts});await loadPosts();}catch(e){alert(e.message);}}
  </script></body></html>`;
}
