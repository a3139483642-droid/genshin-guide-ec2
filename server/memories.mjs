import {Router} from 'express';
import multer from 'multer';
import {z} from 'zod';
import {one,rows,tx} from './db.mjs';
import {requireOwner,id,audit,rate} from './auth.mjs';
import {problem} from './schema.mjs';
import {detect} from './parser.mjs';
import {putFile,getFile,removeFile} from './storage.mjs';

export const memories=Router();
// Authorize before parsing uploads, reading metadata, or accessing image bytes.
memories.use((req,res,next)=>{requireOwner(req);next();});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:3*1024*1024,files:1,fields:2}}).single('file');
const metadata=z.object({title:z.string().trim().min(1,'请填写照片标题').max(100),caption:z.string().trim().max(1000)});
export const memoryFileKey=photoId=>'memory-'+photoId;
async function photo(req){
  const item=await one('SELECT * FROM memory_photos WHERE id=$1 AND owner_id=$2',[req.params.id,req.user.id]);
  if(!item)problem(404,'照片不存在或已删除');
  return item;
}

memories.get('/',async(req,res)=>{
  const {page,q}=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),q:z.string().trim().max(100).default('')}).parse(req.query);
  const args=[req.user.id,'%'+q+'%'];
  const where='owner_id=$1 AND (title ILIKE $2 OR caption ILIKE $2 OR filename ILIKE $2)';
  const counts=await one('SELECT count(*)::integer AS total,COALESCE(sum(size),0)::bigint AS bytes FROM memory_photos WHERE '+where,args);
  const items=await rows('SELECT * FROM memory_photos WHERE '+where+' ORDER BY created_at DESC,id DESC LIMIT 24 OFFSET $3',[...args,(page-1)*24]);
  res.json({items,total:counts.total,bytes:Number(counts.bytes),page,pageSize:24});
});

memories.post('/',upload,async(req,res)=>{
  await rate('memory-upload:'+req.user.id,120,3600);
  if(!req.file?.buffer.length)problem(400,'请选择图片');
  const filename=Buffer.from(req.file.originalname,'latin1').toString('utf8').replace(/\uFFFD/g,'')||'照片';
  let mime;
  try{mime=detect(req.file.buffer,filename);}catch{problem(400,'请选择格式正确的 PNG、JPEG 或 WebP 图片');}
  if(!['image/png','image/jpeg','image/webp'].includes(mime))problem(400,'只允许 PNG、JPEG、WebP 图片');
  const data=metadata.parse({title:req.body.title||filename.replace(/\.[^.]+$/,'').slice(0,100),caption:req.body.caption||''});
  const photoId=id(),key=memoryFileKey(photoId);
  await putFile(key,req.file.buffer);
  let item;
  try{
    item=await tx(async c=>{
      const result=await c.query('INSERT INTO memory_photos(id,owner_id,filename,mime,size,title,caption) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[photoId,req.user.id,filename.slice(0,160),mime,req.file.size,data.title,data.caption]);
      await audit(req.user.id,'memory_upload',photoId,c);
      return result.rows[0];
    });
  }catch(error){await removeFile(key).catch(()=>{});throw error;}
  res.status(201).json(item);
});

memories.get('/:id/image',async(req,res)=>{
  const item=await photo(req);
  const buffer=await getFile(memoryFileKey(item.id));
  res.set({'Content-Type':item.mime,'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':(req.query.download==='1'?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(item.filename)}).send(buffer);
});

memories.patch('/:id',async(req,res)=>{
  const item=await photo(req),data=metadata.parse(req.body);
  const updated=await tx(async c=>{
    const result=await c.query('UPDATE memory_photos SET title=$2,caption=$3 WHERE id=$1 RETURNING *',[item.id,data.title,data.caption]);
    if(!result.rows.length)problem(404,'照片不存在或已删除');
    await audit(req.user.id,'memory_edit',item.id,c);
    return result.rows[0];
  });
  res.json(updated);
});

memories.delete('/:id',async(req,res)=>{
  const item=await photo(req);
  await tx(async c=>{
    await c.query('DELETE FROM memory_photos WHERE id=$1',[item.id]);
    await audit(req.user.id,'memory_delete',item.id,c);
  });
  await removeFile(memoryFileKey(item.id));
  res.json({ok:true});
});
