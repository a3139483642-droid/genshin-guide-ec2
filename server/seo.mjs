import {one,rows} from './db.mjs';
import {seed} from './seed.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function guideHtml(p){
  const d=p.data,modules=(d.modules||[]).filter(m=>!m.hidden);
  const ids=d.format==='image'?d.imageIds||[]:[...new Set([...(d.imageIds||[]),...modules.flatMap(m=>m.assetIds||[])])];
  const images=ids.map((id,i)=>`<img src="/api/assets/${esc(id)}" alt="${esc(d.title)} · 第 ${i+1} 张攻略图" style="max-width:100%;height:auto"/>`).join('');
  const text=d.format==='image'?'':modules.filter(m=>m.body?.trim()).map(m=>`<section><h3>${esc(m.title)}</h3><p>${esc(m.body).replace(/\n/g,'<br>')}</p></section>`).join('');
  const comment=d.authorComment||(ids.length?d.summary:'');
  return `<article id="guide-${esc(p.id)}"><h2>${esc(d.title)}</h2>${images}${!ids.length&&d.summary?`<p>${esc(d.summary)}</p>`:''}${text}${comment?`<section><h3>作者评语</h3><p>${esc(comment).replace(/\n/g,'<br>')}</p></section>`:''}<p>图片作者：${esc(d.imageAuthor||'未署名')} · 整理发布：${esc(p.author)}</p><p>适用版本：${esc(d.gameVersion||'来源未注明')} · 来源：${esc(d.source)}</p></article>`;
}

export async function seoCharacter(characterId,planId,html){
  await seed();
  const c=await one('SELECT * FROM characters WHERE id=$1 AND visible=TRUE',[characterId]);
  const missing=message=>({status:404,html:html.replace('<div id="root"></div>',`<div id="root"><h1>${message}</h1></div>`)});
  if(!c)return missing('角色不存在');
  const plans=await rows("SELECT p.id,p.title,v.data,v.created_at AS updated_at,u.display_name AS author FROM plans p JOIN versions v ON v.id=p.public_version JOIN users u ON u.id=p.owner_id WHERE p.character_id=$1 AND p.status='published' ORDER BY v.created_at DESC,p.id",[c.id]);
  if(planId&&!plans.some(p=>p.id===planId))return missing('攻略不存在或已下架');
  plans.sort((a,b)=>Number(b.id===planId)-Number(a.id===planId)||Number(b.id===c.recommended_plan)-Number(a.id===c.recommended_plan));
  const content=`<article><h1>${esc(c.name)}角色攻略</h1><p>${c.element==='多'?'元素可切换':esc(c.element)+'元素'} / ${esc(c.weapon)}</p>${plans.length?plans.map(guideHtml).join(''):'<p>攻略待补充</p>'}</article>`;
  return {status:200,html:html.replace('<title>提瓦特旅行手册 · 原神角色攻略</title>',`<title>${esc(c.name)}攻略 · 提瓦特旅行手册</title>`).replace('<div id="root"></div>',`<div id="root">${content}</div>`)};
}
