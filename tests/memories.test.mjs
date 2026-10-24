import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

for(const key of ['NETLIFY','AWS_LAMBDA_FUNCTION_NAME','DATABASE_URL','NETLIFY_DB_URL','NETLIFY_DB_DRIVER','TEYVAT_PROJECT_ROOT'])delete process.env[key];
delete globalThis.Netlify;
process.env.DATA_DIR=await mkdtemp(path.join(os.tmpdir(),'teyvat-memories-'));
const {app}=await import('../server/app.mjs');
const {database,one}=await import('../server/db.mjs');
const {getFile}=await import('../server/storage.mjs');
const {exportBackup,restoreInto}=await import('../server/backup.mjs');
const {default:nativeApi}=await import('../netlify/functions/api.mjs');
const owner=request.agent(app),publisher=request.agent(app),visitor=request.agent(app),anonymous=request(app);
const base='/api/owner/memories';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1kAAAAASUVORK5CYII=','base64');
let csrf,pubCsrf,userCsrf,cookie,photo;
const write=(method,url,body)=>owner[method](url).set('X-CSRF-Token',csrf).send(body);
after(async()=>{await (await database()).close();});

test('private memories: access, original uploads, isolation, persistence and backup',async t=>{
  await t.test('existing owner, publisher and user sessions keep their established roles',async()=>{
    const setup=await owner.post('/api/setup').send({username:'memory_owner',password:'memory-test-passphrase',includeSample:false});
    assert.equal(setup.status,200);csrf=setup.body.csrf;cookie=setup.headers['set-cookie'][0].split(';')[0];
    await write('post','/api/owner/users',{username:'memory_publisher',password:'memory-test-passphrase'});
    const publisherLogin=await publisher.post('/api/login').send({username:'memory_publisher',password:'memory-test-passphrase'});pubCsrf=publisherLogin.body.csrf;
    const register=await visitor.post('/api/register').send({username:'memory_visitor',password:'memory-test-passphrase',role:'owner'});userCsrf=register.body.csrf;
    assert.equal(register.body.user.role,'user');
    assert.deepEqual((await owner.get(base)).body,{items:[],total:0,bytes:0,page:1,pageSize:24});
  });

  await t.test('only owner can upload, and original image bytes plus Chinese filename persist',async()=>{
    for(const [agent,token,status] of [[anonymous,null,401],[publisher,pubCsrf,403],[visitor,userCsrf,403]]){
      let req=agent.post(base);if(token)req=req.set('X-CSRF-Token',token);
      assert.equal((await req.attach('file',png,'private.png')).status,status);
    }
    assert.equal((await owner.post(base).attach('file',png,'no-csrf.png')).status,403);
    const uploaded=await owner.post(base).set('X-CSRF-Token',csrf).field('caption','只属于站长的记忆').attach('file',png,'旅途留影.png');
    assert.equal(uploaded.status,201,JSON.stringify(uploaded.body));photo=uploaded.body;
    assert.equal(photo.filename,'旅途留影.png');assert.equal(photo.title,'旅途留影');assert.equal(photo.caption,'只属于站长的记忆');
    assert.deepEqual(await getFile('memory-'+photo.id),png);
    assert.deepEqual((await owner.get(base+'/'+photo.id+'/image')).body,png);
    assert.equal((await one('SELECT count(*)::integer AS count FROM assets')).count,0);
  });

  await t.test('all metadata, original, download, edit and delete endpoints enforce server permissions',async()=>{
    for(const [agent,token,status] of [[anonymous,null,401],[publisher,pubCsrf,403],[visitor,userCsrf,403]]){
      for(const suffix of ['', '/'+photo.id+'/image','/'+photo.id+'/image?download=1']){
        const response=await agent.get(base+suffix);assert.equal(response.status,status);
        assert.ok(!JSON.stringify(response.body).includes('旅途留影'));assert.match(response.headers['cache-control'],/no-store/);
      }
      for(const method of ['patch','delete']){
        let req=agent[method](base+'/'+photo.id);if(token)req=req.set('X-CSRF-Token',token);
        assert.equal((await req.send({title:'入侵修改',caption:''})).status,status);
      }
    }
    for(const id of [photo.id,'memory-'+photo.id])assert.equal((await anonymous.get('/api/assets/'+id)).status,404);
    const attachment=await owner.get(base+'/'+photo.id+'/image?download=1');
    assert.match(attachment.headers['content-disposition'],/^attachment;/);assert.match(attachment.headers['cache-control'],/private, no-store/);
    assert.equal(attachment.headers['cross-origin-resource-policy'],'same-origin');assert.deepEqual(attachment.body,png);
    assert.equal((await owner.patch(base+'/'+photo.id).send({title:'没有令牌',caption:''})).status,403);
    assert.equal((await write('patch',base+'/'+photo.id,{title:'璃月的夜色',caption:'<script>仅作为文字</script>\n与派蒙同行'})).status,200);
    const found=(await owner.get(base+'?q='+encodeURIComponent('派蒙'))).body;
    assert.equal(found.total,1);assert.equal(found.items[0].title,'璃月的夜色');
    assert.equal((await owner.get(base+'?q=does-not-exist')).body.total,0);
  });

  await t.test('invalid formats, oversized files, invalid metadata and pagination are rejected',async()=>{
    for(const [buffer,name] of [[Buffer.from('<svg onload="alert(1)"/>'),'evil.png'],[png,'image.svg'],[Buffer.from('plain text'),'secret.txt'],[Buffer.alloc(0),'empty.png']]){
      assert.equal((await owner.post(base).set('X-CSRF-Token',csrf).attach('file',buffer,name)).status,400);
    }
    assert.equal((await owner.post(base).set('X-CSRF-Token',csrf).attach('file',Buffer.alloc(3*1024*1024+1),'big.png')).status,413);
    assert.equal((await owner.post(base).set('X-CSRF-Token',csrf).send({})).status,400);
    assert.equal((await write('patch',base+'/'+photo.id,{title:'',caption:''})).status,400);
    assert.equal((await write('patch',base+'/'+photo.id,{title:'标题',caption:'x'.repeat(1001)})).status,400);
    for(const page of ['0','-1','1.5','abc','10001'])assert.equal((await owner.get(base+'?page='+page)).status,400);
    assert.equal((await owner.get(base+'/nonexistent/image')).status,404);
    const plan=await write('post','/api/admin/plans',{characterId:'kazuha',data:{format:'image',title:'不允许公开相簿图片',imageIds:[photo.id]}});
    assert.equal(plan.status,400,'memory pictures cannot be published by using their IDs as guide assets');
  });

  await t.test('native Netlify function preserves protected binary uploads and downloads',async()=>{
    const invoke=(url,options={})=>nativeApi(new Request('https://site.test'+url,{...options,headers:{host:'site.test','x-forwarded-proto':'https',...options.headers}}),{requestId:'memory-test',ip:'127.0.0.1'});
    const form=new FormData();form.append('file',new Blob([png],{type:'image/png'}),'native-memory.png');
    const uploaded=await invoke(base,{method:'POST',headers:{cookie,'x-csrf-token':csrf},body:form});
    assert.equal(uploaded.status,201,await uploaded.clone().text());
    const nativePhoto=await uploaded.json();
    const response=await invoke('/.netlify/functions/api/owner/memories/'+nativePhoto.id+'/image',{headers:{cookie}});
    assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
    assert.equal((await invoke(base+'/'+nativePhoto.id+'/image')).status,401);
  });

  await t.test('large collections paginate without losing older photos',async()=>{
    for(let i=0;i<23;i++){
      const upload=await owner.post(base).set('X-CSRF-Token',csrf).attach('file',png,'moment-'+i+'.png');
      assert.equal(upload.status,201);
    }
    const first=(await owner.get(base)).body,second=(await owner.get(base+'?page=2')).body;
    assert.equal(first.total,25);assert.equal(first.bytes,25*png.length);assert.equal(first.items.length,24);assert.equal(second.items.length,1);
    assert.equal(new Set([...first.items,...second.items].map(p=>p.id)).size,25);
  });

  await t.test('backup and restore include private originals and accept backups predating the album',async()=>{
    const data=await exportBackup();assert.equal(data.tables.memory_photos.length,25);
    assert.deepEqual(Buffer.from(data.files['memory-'+photo.id],'base64'),png);
    const {PGlite}=await import('@electric-sql/pglite'),schema=await readFile('server/migrations/001_initial.sql','utf8');
    const target=new PGlite();await target.exec(schema);
    try{await restoreInto(target,data);assert.equal((await target.query('SELECT title FROM memory_photos WHERE id=$1',[photo.id])).rows[0].title,'璃月的夜色');}
    finally{await target.close();}
    const old={...data,tables:{...data.tables}};delete old.tables.memory_photos;
    const oldTarget=new PGlite();await oldTarget.exec(schema);
    try{await restoreInto(oldTarget,old);assert.equal(Number((await oldTarget.query('SELECT count(*) FROM memory_photos')).rows[0].count),0);}
    finally{await oldTarget.close();}
  });

  await t.test('deletion removes the private original; logout revokes image access immediately',async()=>{
    assert.equal((await write('delete',base+'/'+photo.id)).status,200);
    assert.equal((await owner.get(base+'/'+photo.id+'/image')).status,404);
    await assert.rejects(getFile('memory-'+photo.id));
    assert.equal((await owner.get(base)).body.total,24);
    const remaining=(await owner.get(base)).body.items[0];
    assert.equal((await write('post','/api/logout',{})).status,200);
    assert.equal((await owner.get(base+'/'+remaining.id+'/image')).status,401);
  });
});
