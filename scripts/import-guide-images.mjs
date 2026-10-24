// Local, offline maintenance import. Stop npm run dev/start before running this.
// node scripts/import-guide-images.mjs .data/guide-imports/20261023/manifest.json [--apply]
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {database,rows,tx,cloud,dataDir} from '../server/db.mjs';
import {guideSchema} from '../server/schema.mjs';
import {getFile,putFile,removeFile} from '../server/storage.mjs';
import {exportBackup} from '../server/backup.mjs';

const manifestPath=path.resolve(process.argv[2]||'.data/guide-imports/20261023/manifest.json');
const apply=process.argv.includes('--apply');
const digest=value=>createHash('sha256').update(value).digest('hex');
function uuid(key){const s=digest(key);return `${s.slice(0,8)}-${s.slice(8,12)}-5${s.slice(13,16)}-a${s.slice(17,20)}-${s.slice(20,32)}`;}
async function listening(port){return new Promise(resolve=>{const socket=net.connect({port,host:'127.0.0.1'});socket.on('connect',()=>{socket.destroy();resolve(true);});socket.on('error',()=>resolve(false));socket.setTimeout(1000,()=>{socket.destroy();resolve(false);});});}
assert(!cloud&&!process.env.DATABASE_URL,'This maintenance command only supports the local database');
assert(!await listening(Number(process.env.PORT||4173)),'Stop the local server before opening its PGlite database');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
assert.equal(manifest.format,'teyvat-guide-image-batch-v1');
assert.equal(manifest.authorComment,'','This batch must have empty author comments');
assert(manifest.images.length>0);
const base=path.dirname(manifestPath),imageBuffers=new Map(),groups=new Map();
for(const item of manifest.images){
  const file=path.resolve(base,item.file);
  assert(file.startsWith(base+path.sep),'Image must stay within the archived batch');
  const bytes=await readFile(file);
  assert.equal(digest(bytes),item.sha256,`Image checksum mismatch: ${item.characterName}`);
  assert.equal(bytes.length,item.size);
  assert(bytes.length<=3*1024*1024,'Image exceeds normal upload size');
  assert.equal(bytes.readUInt16BE(0),0xffd8,'Expected an original JPEG');
  const assetId=uuid('guide-image:'+item.sha256);
  imageBuffers.set(assetId,{...item,assetId,bytes});
  const list=groups.get(item.characterName)||[];
  assert(!list.includes(assetId),'Duplicate image in a character guide');
  list.push(assetId);groups.set(item.characterName,list);
}
let db;
const addedFiles=[];
let committed=false;
try{
  db=await database();
  const owners=await rows("SELECT id,display_name FROM users WHERE role='owner' AND disabled=FALSE");
  assert.equal(owners.length,1,'A single active site owner must already exist');
  const owner=owners[0],characters=await rows('SELECT id,name,visible FROM characters');
  const jobs=[];
  for(const [name,imageIds] of groups){
    const targets=name==='旅行者'?characters.filter(c=>['aether','lumine'].includes(c.id)):characters.filter(c=>c.name===name);
    assert.equal(targets.length,name==='旅行者'?2:1,`Character mapping failed: ${name}`);
    for(const c of targets){
      assert(c.visible,`Character is hidden: ${c.name}`);
      const id=uuid(manifest.batchId+':'+c.id);
      const data=guideSchema.parse({title:name==='旅行者'?`${c.name} · 冰元素旅行者攻略`:`${c.name}攻略`,format:'image',imageIds,imageAuthor:manifest.imageAuthor,authorComment:'',summary:'',source:manifest.source,gameVersion:manifest.gameVersion,modules:[]});
      const existing=(await rows('SELECT status,owner_id,draft,public_version FROM plans WHERE id=$1',[id]))[0];
      if(existing){
        assert.equal(existing.owner_id,owner.id,'Existing guide ownership mismatch');
        assert.equal(existing.status,'published','Previously imported guide was changed; refusing to republish');
        assert.deepEqual(existing.draft,data,'Previously imported guide was edited; refusing to overwrite');
        const published=(await rows('SELECT data FROM versions WHERE id=$1',[existing.public_version]))[0];
        assert.deepEqual(published?.data,data,'Published version differs from this batch');
      }
      jobs.push({id,characterId:c.id,characterName:c.name,data,exists:Boolean(existing)});
    }
  }
  const newAssets=[];
  for(const image of imageBuffers.values()){
    const existing=(await rows('SELECT owner_id,mime,kind,size FROM assets WHERE id=$1',[image.assetId]))[0];
    if(existing){
      assert.equal(existing.owner_id,owner.id);assert.equal(existing.mime,'image/jpeg');
      assert.equal(existing.kind,'image');assert.equal(existing.size,image.size);
      assert.equal(digest(await getFile(image.assetId)),image.sha256);
    }else newAssets.push(image);
  }
  const newJobs=jobs.filter(j=>!j.exists);
  const summary={mode:apply?'apply':'dry-run',batchId:manifest.batchId,inputAttachments:manifest.attachments.length,uniqueImages:imageBuffers.size,duplicateAttachments:manifest.attachments.length-imageBuffers.size,characterGuides:jobs.length,newAssets:newAssets.length,newGuides:newJobs.length,emptyAuthorComments:jobs.length,dataDir};
  if(!apply){console.log(JSON.stringify(summary));}
  else{
    let backupFile=null;
    if(newJobs.length||newAssets.length){
      backupFile=path.join(base,'pre-import-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
      await writeFile(backupFile,JSON.stringify(await exportBackup()),{flag:'wx'});
      for(const image of newAssets){
        // Never overwrite an untracked file with the deterministic storage ID.
        let previous;try{previous=await getFile(image.assetId);}catch(e){if(e.code!=='ENOENT')throw e;}
        if(previous)assert.equal(digest(previous),image.sha256,'Untracked storage file conflicts with batch');
        else{await putFile(image.assetId,image.bytes);addedFiles.push(image.assetId);}
        assert.equal(digest(await getFile(image.assetId)),image.sha256);
      }
      await tx(async c=>{
        for(const image of newAssets)await c.query("INSERT INTO assets(id,owner_id,filename,mime,kind,size) VALUES($1,$2,$3,'image/jpeg','image',$4)",[image.assetId,owner.id,image.characterName+'攻略.jpg',image.size]);
        for(const job of newJobs){
          const versionId=uuid(manifest.batchId+':version:'+job.id),data=JSON.stringify(job.data);
          await c.query("INSERT INTO plans(id,character_id,owner_id,status,title,draft,revision,public_version,published_at) VALUES($1,$2,$3,'published',$4,$5,2,$6,now())",[job.id,job.characterId,owner.id,job.data.title,data,versionId]);
          await c.query('INSERT INTO versions(id,plan_id,number,data) VALUES($1,$2,1,$3)',[versionId,job.id,data]);
          await c.query("INSERT INTO audit(id,user_id,action,target) VALUES($1,$2,'publish_v1',$3)",[uuid(manifest.batchId+':publish:'+job.id),owner.id,job.id]);
        }
        await c.query("INSERT INTO audit(id,user_id,action,target) VALUES($1,$2,'bulk_import_guide_images',$3)",[uuid(manifest.batchId+':audit'),owner.id,manifest.batchId]);
      });
      committed=true;
    }
    for(const job of jobs){
      const row=(await rows("SELECT p.status,p.character_id,v.data FROM plans p JOIN versions v ON v.id=p.public_version WHERE p.id=$1",[job.id]))[0];
      assert.equal(row.status,'published');assert.equal(row.character_id,job.characterId);
      assert.deepEqual(row.data,job.data);
    }
    const report={...summary,importedAt:new Date().toISOString(),backupFile,verified:true,guides:jobs.map(j=>({id:j.id,characterId:j.characterId,characterName:j.characterName,title:j.data.title,imageIds:j.data.imageIds,authorComment:j.data.authorComment})),images:[...imageBuffers.values()].map(({bytes,...image})=>image)};
    await writeFile(path.join(base,'import-result.json'),JSON.stringify(report,null,2)+'\n');
    const reportDir=path.resolve('docs/攻略图片导入-20261023');await mkdir(reportDir,{recursive:true});
    await writeFile(path.join(reportDir,'导入结果.json'),JSON.stringify({...report,backupFile:backupFile?path.relative(dataDir,backupFile):null,dataDir:'.data'},null,2)+'\n');
    console.log(JSON.stringify({...summary,verified:true}));
  }
}catch(error){
  if(!committed)for(const id of addedFiles)await removeFile(id);
  throw error;
}finally{await db?.close();}
