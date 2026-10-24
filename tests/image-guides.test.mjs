import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
for(const key of ['NETLIFY','AWS_LAMBDA_FUNCTION_NAME','DATABASE_URL','NETLIFY_DB_URL','NETLIFY_DB_DRIVER','TEYVAT_PROJECT_ROOT'])delete process.env[key];
delete globalThis.Netlify;
process.env.DATA_DIR=await mkdtemp(path.join(os.tmpdir(),'teyvat-image-guide-'));
const {app}=await import('../server/app.mjs');
const {database}=await import('../server/db.mjs');
const {seoCharacter}=await import('../server/seo.mjs');
const owner=request.agent(app),publisher=request.agent(app),anonymous=request(app);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1kAAAAASUVORK5CYII=','base64');
let csrf,pubCsrf,first,second,privateImage,planId;
const write=(method,url,body)=>owner[method]('/api'+url).set('X-CSRF-Token',csrf).send(body);
after(async()=>{await (await database()).close();});

test('direct image guides: publish, privacy, attribution, revisions and indexing',async t=>{
  await t.test('direct uploads preserve the original and stay private',async()=>{
    const init=await owner.post('/api/setup').send({username:'image_keeper',password:'image-guide-test-passphrase',displayName:'上传管理员',includeSample:false});
    assert.equal(init.status,200);csrf=init.body.csrf;
    const ids=[];
    for(let i=0;i<3;i++){
      const r=await owner.post('/api/admin/images').set('X-CSRF-Token',csrf).attach('file',png,'guide-'+i+'.png');
      assert.equal(r.status,200,JSON.stringify(r.body));ids.push(r.body.id);
      assert.equal((await anonymous.get('/api/assets/'+r.body.id)).status,401);
      assert.deepEqual((await owner.get('/api/assets/'+r.body.id)).body,png);
    }
    [first,second,privateImage]=ids;
  });
  await t.test('empty and duplicate images are rejected; other publishers cannot use private uploads',async()=>{
    const data={format:'image',title:'图片攻略',imageIds:[]};
    assert.equal((await write('post','/admin/plans',{characterId:'kazuha',data})).status,400);
    assert.equal((await write('post','/admin/plans',{characterId:'kazuha',data:{...data,imageIds:[first,first]}})).status,400);
    await write('post','/owner/users',{username:'image_publisher',password:'image-guide-test-passphrase',displayName:'另一管理员'});
    const login=await publisher.post('/api/login').send({username:'image_publisher',password:'image-guide-test-passphrase'});pubCsrf=login.body.csrf;
    const foreign=await publisher.post('/api/admin/plans').set('X-CSRF-Token',pubCsrf).send({characterId:'kazuha',data:{...data,imageIds:[first]}});
    assert.equal(foreign.status,404);
  });
  await t.test('image-only publishing needs no modules, summary or version; author is separate from uploader',async()=>{
    const data={format:'image',title:'长图攻略',imageIds:[first,second],imageAuthor:'原图作者',authorComment:'第一行评语\n<script>只作为文字</script>',modules:[{id:'hidden',type:'notes',title:'私有旧模块',body:'隐藏正文',hidden:true,assetIds:[privateImage]}]};
    const r=await write('post','/admin/plans',{characterId:'kazuha',data});assert.equal(r.status,200,JSON.stringify(r.body));planId=r.body.id;assert.equal(r.body.revision,1);
    assert.equal((await anonymous.get('/api/plans/'+planId)).status,404);
    assert.equal((await write('post','/admin/plans/'+planId+'/publish',{revision:1,confirmed:true})).status,200);
    const published=(await anonymous.get('/api/plans/'+planId)).body;
    assert.equal(published.author,'上传管理员');assert.equal(published.data.imageAuthor,'原图作者');
    assert.equal(published.data.authorComment,data.authorComment);assert.deepEqual(published.data.imageIds,[first,second]);assert.deepEqual(published.data.modules,[]);
    for(const id of [first,second])assert.equal((await anonymous.get('/api/assets/'+id)).status,200);
    assert.equal((await anonymous.get('/api/assets/'+privateImage)).status,401);
    const seo=await seoCharacter('kazuha',planId,'<div id="root"></div>');
    assert.match(seo.html,/作者评语/);assert.match(seo.html,/原图作者/);assert.ok(seo.html.includes('/api/assets/'+first));
    assert.ok(seo.html.includes('&lt;script&gt;'));assert.ok(!seo.html.includes('<script>'));assert.ok(!seo.html.includes(privateImage));
  });
  await t.test('draft changes stay private, revisions conflict, removed images lose public access on republish',async()=>{
    const plan=(await owner.get('/api/admin/plans/'+planId)).body;
    const data={...plan.draft,imageIds:[second],authorComment:'新版评语'};
    const saved=await write('put','/admin/plans/'+planId,{revision:plan.revision,data});assert.equal(saved.status,200);
    assert.equal((await write('put','/admin/plans/'+planId,{revision:plan.revision,data})).status,409);
    assert.deepEqual((await anonymous.get('/api/plans/'+planId)).body.data.imageIds,[first,second]);
    assert.equal((await write('post','/admin/plans/'+planId+'/publish',{revision:saved.body.revision,confirmed:true})).status,200);
    assert.equal((await anonymous.get('/api/assets/'+first)).status,401);assert.equal((await anonymous.get('/api/assets/'+second)).status,200);
    assert.equal((await anonymous.get('/api/plans/'+planId)).body.data.authorComment,'新版评语');
  });
  await t.test('all guides are indexed in reading order; unlisting and hiding revoke access',async()=>{
    const newer=await write('post','/admin/plans',{characterId:'kazuha',data:{format:'image',title:'较新攻略',imageIds:[first]}});
    assert.equal((await write('post','/admin/plans/'+newer.body.id+'/publish',{revision:1,confirmed:true})).status,200);
    const character=(await anonymous.get('/api/characters/kazuha')).body;
    assert.equal(character.plans[0].id,newer.body.id);assert.ok(character.plans[0].updated_at);
    let seo=await seoCharacter('kazuha',null,'<div id="root"></div>');assert.ok(seo.html.indexOf('较新攻略')<seo.html.indexOf('长图攻略'));
    seo=await seoCharacter('kazuha',planId,'<div id="root"></div>');assert.ok(seo.html.indexOf('长图攻略')<seo.html.indexOf('较新攻略'));
    await write('post','/admin/plans/'+newer.body.id+'/unlist',{});assert.equal((await anonymous.get('/api/assets/'+first)).status,401);
    await write('put','/owner/characters/kazuha',{...character.character,visible:false});
    assert.equal((await anonymous.get('/api/assets/'+second)).status,401);assert.equal((await anonymous.get('/api/plans/'+planId)).status,404);
  });
});
