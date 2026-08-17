const CACHE='dataapp-published-v1-15';
const SHELL=['./published.html','./published.css','./public-app.js','./firebase-config.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin===self.location.origin && url.pathname.endsWith('/app.webmanifest')){
    event.respondWith(Promise.resolve(new Response(JSON.stringify({
      name:url.searchParams.get('name')||'My App',
      short_name:(url.searchParams.get('short')||url.searchParams.get('name')||'My App').slice(0,12),
      id:`./published.html?id=${encodeURIComponent(url.searchParams.get('id')||'')}`,
      start_url:`./published.html?id=${encodeURIComponent(url.searchParams.get('id')||'')}`,
      scope:'./',display:'standalone',
      background_color:url.searchParams.get('bg')||'#ffffff',
      theme_color:url.searchParams.get('theme')||'#6256df',
      orientation:url.searchParams.get('orientation')||'any',
      icons:[
        {src:url.searchParams.get('icon192')||url.searchParams.get('icon512')||'',sizes:'192x192',type:'image/webp',purpose:'any maskable'},
        {src:url.searchParams.get('icon512')||url.searchParams.get('icon192')||'',sizes:'512x512',type:'image/webp',purpose:'any maskable'}
      ]
    }),{headers:{'Content-Type':'application/manifest+json','Cache-Control':'no-store'}})));
    return;
  }
  if(url.origin===self.location.origin){
    event.respondWith((async()=>{
      try{
        const response=await fetch(event.request);
        if(response.ok && ['script','style','document'].includes(event.request.destination)){
          const cache=await caches.open(CACHE); cache.put(event.request,response.clone());
        }
        return response;
      }catch(err){
        const hit=await caches.match(event.request,{ignoreSearch:event.request.destination==='document'});
        if(hit)return hit;
        if(event.request.destination==='document')return caches.match('./published.html');
        throw err;
      }
    })());
  }
});
