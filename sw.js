const CACHE='yohaku-games-v2.4.0';
const ASSETS=['./','./index.html','./sudoku.html','./room.css','./style.css','./src/room.mjs','./src/app.mjs','./src/game.mjs','./src/sudoku.mjs','./games/mines.mjs','./games/mines-engine.mjs','./games/mines.css','./games/cards.mjs','./games/cards-engine.mjs','./games/cards.css','./games/numbers.mjs','./games/numbers-engine.mjs','./games/numbers.css','./games/reversi.mjs','./games/reversi-engine.mjs','./games/reversi.css','./games/nonogram.mjs','./games/nonogram-engine.mjs','./games/nonogram-puzzles.mjs','./games/nonogram.css','./games/wood.mjs','./games/wood-engine.mjs','./games/wood.css','./games/shikaku.mjs','./games/shikaku-engine.mjs','./games/shikaku-puzzles.mjs','./games/shikaku.css','./games/binary.mjs','./games/binary-engine.mjs','./games/binary-puzzles.mjs','./games/binary.css','./games/lights.mjs','./games/lights-engine.mjs','./games/lights-puzzles.mjs','./games/lights.css','./puzzles.json','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('yohaku-sudoku-')||key.startsWith('yohaku-games-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cached;
    if(event.request.mode==='navigate')return (await caches.match(new URL('./',self.location.href))) || Response.error();
    return Response.error();
  }));
});
