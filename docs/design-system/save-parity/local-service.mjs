// Simulator interaction harness. Fictional auth + in-memory HTTP responses only.
// Never imported by the app; bind to loopback and record no passwords/tokens.
// Run: bun docs/design-system/save-parity/local-service.mjs
import data from '../../../apps/mobile/dev/home-fixture.json' with { type: 'json' };
const user = { id: 'fixture-reader', email: 'reader@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { full_name: data.readerName }, created_at: data.now };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp:Math.floor(Date.now()/1000)+86400,aud:'authenticated',role:'authenticated'})}.fictional`;
const bookmarks = new Map([...data.fullItems, ...data.resume].filter(item => item.bookmark).map(item => [item.bookmark.id, structuredClone(item.bookmark)]));
for (const [id, bookmark] of bookmarks) bookmark.collectionId = id === 'bk_8f2a' ? 'typography' : id === 'bk_3e77' ? 'systems' : id === 'bk_91ff' ? 'design' : undefined;
const comments = new Map();
const requests = [];
let empty = false;
let createStatus = 201;
const server = Bun.serve({ hostname: '127.0.0.1', port: 5537, async fetch(request) {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  const headers = {'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,PUT,DELETE,OPTIONS'};
  const response = (value,status=200) => new Response(JSON.stringify(value), {status,headers});
  if (method === 'OPTIONS') return response({});
  const body = method === 'GET' ? {} : await request.json().catch(() => ({}));
  if (path === '/fixture/requests') return response(requests);
  if (path === '/fixture/save-mode') { createStatus = body.status ?? 201; return response({createStatus}); }
  if (path === '/fixture/empty') { empty = body.empty; return response({empty}); }
  requests.push({method,path,scope:url.searchParams.get('scope'),readStatus:url.searchParams.get('read_status'),collectionId:url.searchParams.get('collection_id'), ...(path === '/api/v1/bookmarks' && method === 'POST' ? {sourceUrl:body.source_url,captureSource:body.capture_source,isPrivateLink:body.is_private_link,description:body.description} : {}), ...(method === 'PATCH' ? {note:body.userNote,laterUntil:body.laterUntil} : {}), ...(path.endsWith('/comments') && method === 'POST' ? {body:body.body} : {})});
  if (path === '/auth/v1/token') return response({access_token:token,refresh_token:'fictional-local-refresh',token_type:'bearer',expires_in:86400,user});
  if (path === '/auth/v1/user') return response(user);
  if (path === '/auth/v1/logout') return response({});
  if (path === '/api/v1/share-keys/local-key' && method === 'DELETE') return response({});
  if (path === '/api/v1/share-keys') return response({id:'local-key',key:'local-fixture-only'});
  if (path === '/api/v1/bookmarks/feed') return response({items:empty ? [] : url.searchParams.get('scope') === 'unread' ? data.items.filter(item=>item.type==='own_save') : url.searchParams.get('scope') === 'following' ? data.items.filter(item=>item.type==='followed_save') : data.items,computedAt:data.computedAt});
  if (path === '/api/v1/bookmarks/counts') return response(data.navigation.counts);
  if (path === '/api/v1/bookmarks/continue-reading') return response({items:empty?[]:data.resume});
  if (path === '/api/v1/collections') return response({collections:data.navigation.collections});
  if (path === '/api/v1/bookmarks' && method === 'POST') {
    if (createStatus !== 201) return response({error:'Fixture save temporarily unavailable'},createStatus);
    const existing = [...bookmarks.values()].find(item => item.sourceUrl === body.source_url);
    if (existing) return response({bookmark:existing,message:'Already saved',alreadySaved:true});
    const bookmark = {...structuredClone(data.items[1].bookmark),id:`captured-${bookmarks.size}`,userId:user.id,title:body.title || body.source_url,sourceUrl:body.source_url,isPrivateLink:body.is_private_link || false,description:body.description,processingStatus:'processing',userNote:body.user_note,laterUntil:body.later_until,createdAt:data.now};
    bookmarks.set(bookmark.id,bookmark); return response({bookmark,message:'Saved in the local fixture',alreadySaved:false},201);
  }
  if (path === '/api/v1/bookmarks') {
    const filtered = [...bookmarks.values()].filter(bookmark => url.searchParams.get('scope') === 'archive' ? bookmark.isArchived : !bookmark.isArchived)
      .filter(bookmark => url.searchParams.get('scope') !== 'inbox' || !bookmark.collectionId)
      .filter(bookmark => !url.searchParams.get('collection_id') || bookmark.collectionId === url.searchParams.get('collection_id'))
      .filter(bookmark => url.searchParams.get('read_status') !== 'unread' || !bookmark.readAt);
    return response({bookmarks:filtered,total:filtered.length});
  }
  if (path === '/api/v1/users/reader/saves') return response({bookmarks:[],hasMore:false});
  if (path === '/api/v1/profile') return response({id:user.id,name:data.readerName,handle:'reader'});
  const parts = path.split('/');
  const id = parts[4] === 'shared' ? parts[5] : parts[4];
  const bookmark = bookmarks.get(id);
  if (!bookmark) return response({error:'No local fixture for this route'},404);
  if (parts[5] === 'comments') {
    const list = comments.get(id) ?? [];
    if (method === 'POST') { const comment={id:`comment-${list.length}`,bookmarkId:id,body:body.body,author:{id:user.id,name:data.readerName,handle:'reader'},createdAt:data.now,updatedAt:data.now,isEdited:false,isDeleted:false,isOwn:true,canEdit:true}; list.push(comment); comments.set(id,list); return response(comment,201); }
    return response({comments:list});
  }
  if (parts[5] === 'processing-timeline') return response({bookmark,pollAfterMs:60000,events:[{id:'phase',runId:'fixture',kind:'phase',phase:'summarise',name:'Summarising',status:'running',sequence:1,startedAt:data.now}]});
  if (parts[5] === 'content') return response({blocks:[{type:'heading',text:bookmark.title,level:1},...Array.from({length:12},(_,i)=>({type:'paragraph',text:`${i+1}. This is local fixture content for the simulator reading flow. Remember what you already tried before expanding the context window.`}))],wordCount:300,source:'extracted',updatedAt:data.now});
  if (parts[5] === 'progress') { const progress = {bookmarkId:id,percent:body.percent ?? 64,updatedAt:data.now}; return response(method === 'GET' ? { progress } : progress); }
  if (parts[5] === 'highlights') return response({highlights:[]});
  if (parts[5] === 'read') { bookmark.readAt = method === 'POST' ? data.now : undefined; return response(bookmark); }
  if (parts[5] === 'like') return response({likeCount:129,isLikedByCurrentUser:true});
  if (method === 'PATCH') Object.assign(bookmark,body);
  return response(bookmark);
}});
console.log(`Local Save fixture service: ${server.url} (fictional auth, memory only)`);
