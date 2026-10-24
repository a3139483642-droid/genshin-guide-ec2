// Uses an isolated database. Pass a real long image; never writes to the user's .data.
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const image=process.argv[2];
if(!image||!existsSync(image))throw new Error('请传入一张真实长图的绝对路径');
const modulePath=process.env.PLAYWRIGHT_MODULE;
const {chromium}=await import(modulePath?pathToFileURL(modulePath).href:'playwright');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'teyvat-image-ui-'));
const output=path.resolve('docs/图片攻略改版-20261023');await mkdir(output,{recursive:true});
const base='http://127.0.0.1:4181',env={...process.env,PORT:'4181',DATA_DIR:dataDir};
for(const key of ['NETLIFY','AWS_LAMBDA_FUNCTION_NAME','DATABASE_URL','NETLIFY_DB_URL','NETLIFY_DB_DRIVER','TEYVAT_PROJECT_ROOT'])delete env[key];
const server=spawn(process.execPath,['server/local.mjs','--production'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
let browser,activePage;
const pageErrors=[];
const report={isolatedData:true,checks:[],screenshots:[],viewportChecks:[]};
async function loaded(page){await page.locator('.guide-image-button img').first().waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('.guide-image-button img')).every(i=>i.complete&&i.naturalWidth>0));}
async function screenshot(page,name){await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:path.join(output,name),fullPage:true});report.screenshots.push(name);}
async function overflow(page,label){const m=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));assert.ok(m.content<=m.width+1,label+': '+JSON.stringify(m));report.viewportChecks.push({label,...m});}
try{
  let up=false;for(let i=0;i<60;i++){try{const r=await fetch(base+'/api/status');if(r.ok){up=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  assert.ok(up,'测试服务启动失败：'+logs);
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:existsSync(edge)?{executablePath:edge}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'}),page=await context.newPage();
  activePage=page;page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(base+'/setup');
  await page.getByLabel('账号',{exact:true}).fill('image_ui_keeper');
  await page.getByLabel('显示名称',{exact:true}).fill('攻略整理员');
  await page.getByLabel('密码',{exact:true}).fill('ui-only-passphrase-2026');
  await page.getByRole('checkbox',{name:/添加一份/}).uncheck();
  await page.getByRole('button',{name:/创建站点/}).click();await page.waitForURL(base+'/admin');
  await page.getByRole('link',{name:'＋ 发布攻略',exact:true}).click();
  await page.getByLabel('所属角色',{exact:true}).selectOption('vesna');
  assert.equal(await page.getByLabel('攻略标题',{exact:true}).inputValue(),'薇斯纳攻略');
  await page.getByLabel('上传攻略图片',{exact:true}).setInputFiles([image,image]);
  await page.waitForFunction(()=>document.querySelectorAll('.image-upload-list li').length===2&&!document.querySelector('.image-editor-fields').disabled);
  const before=await page.locator('.image-upload-list img').evaluateAll(imgs=>imgs.map(i=>i.src));
  await page.getByRole('button',{name:'上移第 2 张',exact:true}).click();
  assert.deepEqual(await page.locator('.image-upload-list img').evaluateAll(imgs=>imgs.map(i=>i.src)),[before[1],before[0]]);
  await page.getByLabel('替换第 1 张',{exact:true}).setInputFiles(image);
  await page.waitForFunction(old=>document.querySelector('.image-upload-list img').src!==old&&!document.querySelector('.image-editor-fields').disabled,before[1]);
  await page.locator('.image-upload-list li').last().getByRole('button',{name:'移除',exact:true}).click();
  assert.equal(await page.locator('.image-upload-list li').count(),1);
  await page.getByLabel('图片作者（选填）',{exact:true}).fill('原图作者（署名见图片）');
  await page.getByLabel('作者评语（选填）',{exact:true}).fill('配装与配队建议见上方长图。\n请结合自己的角色练度与队伍情况选择。');
  await page.locator('.inline-guide-preview > summary').click();
  await page.getByRole('button',{name:/放大查看：/}).click();
  await page.getByRole('button',{name:'原尺寸',exact:true}).click();
  assert.ok(page.url().endsWith('/admin/import'),'预览放大操作不应触发表单发布');
  await page.getByRole('button',{name:'关闭 ×',exact:true}).click();
  await page.locator('.inline-guide-preview > summary').click();
  await screenshot(page,'后台发布-桌面.png');report.checks.push('多图上传、排序、替换、移除、自动标题、原位预览');
  await page.getByRole('button',{name:'发布攻略',exact:true}).click();
  await page.waitForURL(/\/characters\/vesna\?plan=/);await loaded(page);
  const publicUrl=page.url(),planId=new URL(publicUrl).searchParams.get('plan');
  assert.equal(await page.locator('.planbar,.quick-build,.module-nav,.feedback-actions').count(),0);
  assert.equal(await page.locator('.author-comment p').innerText(),'配装与配队建议见上方长图。\n请结合自己的角色练度与队伍情况选择。');
  const me=await (await page.request.get(base+'/api/me')).json();
  const dash=await (await page.request.get(base+'/api/admin/dashboard')).json();
  assert.equal(dash.imports.length,0,'图片发布不创建解析队列任务');report.checks.push('一键保存并发布，无解析队列，无方案选择或模块卡片');
  const anonymous=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'}),reader=await anonymous.newPage();
  reader.on('pageerror',e=>pageErrors.push(e.message));
  await reader.goto(publicUrl);await loaded(reader);
  const metrics=await reader.locator('.guide-image-button img').evaluate(i=>({naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,width:i.width,height:i.height}));
  assert.ok(Math.abs(metrics.height/metrics.width-metrics.naturalHeight/metrics.naturalWidth)<.01,'长图必须保持原比例');
  for(const width of [1440,768,360]){
    await reader.setViewportSize({width,height:1000});await overflow(reader,'阅读页 '+width);
    if(width!==768)await screenshot(reader,width===1440?'攻略阅读-桌面.png':'攻略阅读-手机.png');
  }
  await reader.locator('.guide-image-button').click();await reader.locator('dialog[open]').waitFor();
  await reader.keyboard.press('Escape');await reader.waitForFunction(()=>!document.querySelector('dialog[open]')&&document.body.style.overflow==='');
  assert.equal(await reader.evaluate(()=>document.body.style.overflow),'');
  assert.equal(await reader.locator('.compact-discussion').getAttribute('open'),null);
  await reader.locator('.compact-discussion > summary').click();await reader.getByText('登录后参与讨论 ↗',{exact:true}).waitFor();
  report.checks.push('游客阅读、长图原比例、三个屏幕宽度、Esc 关闭图片、讨论默认收起');
  for(const width of [1440,768,360]){
    await page.setViewportSize({width,height:1000});await page.goto(base+'/admin/editor/'+planId);
    await page.getByLabel('图片作者（选填）',{exact:true}).waitFor();await overflow(page,'编辑页 '+width);
    if(width===360)await screenshot(page,'后台发布-手机.png');
  }
  const current=await (await page.request.get(base+'/api/plans/'+planId)).json();
  const oldPicture={title:'旧图片攻略',summary:'原有图片评语',modules:[{id:'old-image',type:'notes',title:'攻略图片',body:'',assetIds:[current.data.imageIds[0]],hidden:false}]};
  const oldResponse=await page.request.post(base+'/api/admin/plans',{headers:{'X-CSRF-Token':me.csrf},data:{characterId:'vesna',data:oldPicture}});
  assert.ok(oldResponse.ok());const oldId=(await oldResponse.json()).id;
  await page.goto(base+'/admin/editor/'+oldId);await page.getByLabel('作者评语（选填）',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('作者评语（选填）',{exact:true}).inputValue(),'原有图片评语');
  assert.equal(await page.locator('.image-upload-list li').count(),1);
  await page.getByLabel('作者评语（选填）',{exact:true}).fill('原有图片评语（补充）');
  await page.getByRole('button',{name:'发布攻略',exact:true}).click();await page.waitForURL(/\/characters\/vesna/);
  const converted=await (await page.request.get(base+'/api/plans/'+oldId)).json();
  assert.equal(converted.data.format,'image');assert.deepEqual(converted.data.imageIds,current.data.imageIds);assert.deepEqual(converted.data.modules,[]);
  report.checks.push('旧图片模块自动适配新发布器，原图和旧评语保持完整');
  const legacy={title:'保留旧文字攻略',summary:'原来的文字仍可阅读',source:'验收样例',modules:[{id:'old-notes',type:'notes',title:'旧攻略正文',body:'这里保留原有文字内容。\n不会转换成图片或丢失。',assetIds:[],hidden:false}]};
  const created=await page.request.post(base+'/api/admin/plans',{headers:{'X-CSRF-Token':me.csrf},data:{characterId:'kazuha',data:legacy}});
  assert.ok(created.ok(),await created.text());const legacyId=(await created.json()).id;
  await page.goto(base+'/admin/editor/'+legacyId);await page.getByLabel('旧攻略正文',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('旧攻略正文',{exact:true}).inputValue(),legacy.modules[0].body);
  await page.getByRole('button',{name:'发布攻略',exact:true}).click();await page.waitForURL(/\/characters\/kazuha/);
  await page.getByText(legacy.modules[0].body,{exact:true}).waitFor();report.checks.push('历史文字攻略可编辑和发布，正文保持完整');
  assert.deepEqual(pageErrors,[],'浏览器不应出现脚本异常');
  report.imageMetrics=metrics;report.passed=true;
  await writeFile(path.join(output,'界面验收.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){
  if(activePage){await activePage.screenshot({path:path.join(output,'验收失败.png'),fullPage:true});console.error(JSON.stringify({url:activePage.url(),body:(await activePage.locator('body').innerText()).slice(0,3500),pageErrors}));}
  throw e;
}finally{await browser?.close();server.kill();}
