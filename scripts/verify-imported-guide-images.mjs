// Read-only checks against the real published batch. Does not edit site data.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.SITE_URL||'http://127.0.0.1:4173';
const batch=JSON.parse(await readFile('.data/guide-imports/20261023/import-result.json','utf8'));
const output=path.resolve('docs/攻略图片导入-20261023');await mkdir(output,{recursive:true});
async function json(route){const r=await fetch(base+route);assert.equal(r.status,200,route);return r.json();}
async function batches(items,fn){for(let i=0;i<items.length;i+=6)await Promise.all(items.slice(i,i+6).map(fn));}
let checkedGuides=0,checkedImages=0;
await batches(batch.guides,async guide=>{
  const p=await json('/api/plans/'+guide.id);
  assert.equal(p.characterId,guide.characterId);assert.equal(p.data.title,guide.title);
  assert.equal(p.data.format,'image');assert.equal(p.data.authorComment,'');assert.equal(p.data.summary,'');
  assert.deepEqual(p.data.imageIds,guide.imageIds);assert.deepEqual(p.data.modules,[]);
  const c=await json('/api/characters/'+guide.characterId);
  assert.equal(c.character.name,guide.characterName);assert(c.plans.some(p=>p.id===guide.id));
  checkedGuides++;
});
await batches(batch.images,async image=>{
  const r=await fetch(base+'/api/assets/'+image.assetId);assert.equal(r.status,200);
  assert(r.headers.get('content-type').startsWith('image/jpeg'));
  const bytes=Buffer.from(await r.arrayBuffer());
  assert.equal(bytes.length,image.size);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
  checkedImages++;
});
const available=await json('/api/characters?ready=true');
assert(available.total>=batch.guides.length);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/JIATIANDI/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const errors=[],checks=[],screenshots=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'zh-CN'});
  page.on('pageerror',e=>errors.push(e.message));
  for(const id of ['odette','aether','lumine','kazuha','raiden','ifa']){
    const guide=batch.guides.find(g=>g.characterId===id);assert(guide);
    await page.goto(base+'/characters/'+id+'?plan='+guide.id,{waitUntil:'networkidle'});
    const article=page.locator('#guide-'+guide.id);
    await article.locator('.guide-image-button img').waitFor();
    await article.locator('.guide-image-button img').evaluate(img=>img.decode());
    assert.equal(await article.locator('.author-comment').count(),0);
    const metrics=await article.locator('.guide-image-button img').evaluate(i=>({width:i.width,height:i.height,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight}));
    assert(metrics.naturalWidth>0&&metrics.naturalHeight>0);
    assert(Math.abs(metrics.height/metrics.width-metrics.naturalHeight/metrics.naturalWidth)<.01);
    checks.push({characterId:id,emptyComment:true,originalAspectRatio:true,...metrics});
    if(id==='odette'){
      await page.screenshot({path:path.join(output,'攻略实图-桌面.png'),fullPage:true});screenshots.push('攻略实图-桌面.png');
    }
    if(id==='ifa'){
      await page.setViewportSize({width:390,height:844});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:path.join(output,'攻略实图-手机.png'),fullPage:true});screenshots.push('攻略实图-手机.png');
      await article.locator('.guide-image-button').click();await page.locator('dialog[open]').waitFor();
      await page.getByRole('button',{name:'原尺寸',exact:true}).click();
      assert.equal(await page.locator('dialog .original-size').count(),1);
      await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]')&&document.body.style.overflow==='');
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
    }
  }
  await page.goto(base+'/?ready=true',{waitUntil:'networkidle'});
  assert.equal(await page.getByRole('checkbox',{name:'只看已有攻略'}).isChecked(),true);
  assert(await page.locator('.char-card').count()>0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(output,'已有攻略图鉴-手机.png'),fullPage:true});screenshots.push('已有攻略图鉴-手机.png');
  assert.deepEqual(errors,[]);
  const result={passed:true,checkedAt:new Date().toISOString(),checkedGuides,checkedImages,emptyAuthorComments:checkedGuides,byteIdenticalImages:checkedImages,availableCharacters:available.total,mobileViewer:true,checks,screenshots,browserErrors:errors};
  await writeFile(path.join(output,'前台验收.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({passed:true,checkedGuides,checkedImages,emptyAuthorComments:checkedGuides,byteIdenticalImages:checkedImages,availableCharacters:available.total,browserErrors:errors}));
}finally{await browser.close();}
