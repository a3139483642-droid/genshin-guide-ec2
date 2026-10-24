import {z} from 'zod';
const text=z.string().trim().max(6000);
export const moduleTypes=['weapons','artifacts','stats','talents','teams','rotation','materials','mechanics','notes'];
export const moduleNames={weapons:'武器推荐',artifacts:'圣遗物搭配',stats:'词条选择',talents:'天赋与命座',teams:'配队方案',rotation:'操作循环',materials:'培养路线',mechanics:'机制细节',notes:'补充说明'};
export const moduleSchema=z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),type:z.enum(moduleTypes),title:z.string().trim().min(1).max(80),body:text,source:text.default('手动整理'),hidden:z.boolean().default(false),assetIds:z.array(z.string().uuid()).max(20).default([])}).refine(m=>m.body.length>0||m.assetIds.length>0,{message:'请填写文字内容或添加展示图片',path:['body']});
export const guideSchema=z.object({
  title:z.string().trim().min(1).max(100),
  format:z.enum(['image','legacy']).default('legacy'),
  imageIds:z.array(z.string().uuid()).max(20).default([]),
  imageAuthor:z.string().trim().max(100).default(''),
  authorComment:text.default(''),
  gameVersion:z.string().trim().min(1).max(100).default('来源未注明'),
  summary:text.default(''),source:text.default(''),
  importId:z.string().uuid().optional(),modules:z.array(moduleSchema).max(40).default([])
}).superRefine((v,ctx)=>{
  const issue=(path,message)=>ctx.addIssue({code:'custom',path,message});
  if(v.format==='image'&&!v.imageIds.length)issue(['imageIds'],'请至少上传一张攻略图片');
  if(v.format==='legacy'&&!v.modules.some(m=>!m.hidden))issue(['modules'],'至少需要一份可见攻略内容');
  if(new Set(v.imageIds).size!==v.imageIds.length)issue(['imageIds'],'攻略图片不能重复');
  if(new Set(v.modules.map(m=>m.id)).size!==v.modules.length)issue(['modules'],'模块标识不能重复');
});
export function problem(status,message){const e=new Error(message);e.status=status;throw e;}
export function clean(value,max=6000){return String(value??'').replace(/\u0000/g,'').trim().slice(0,max);}
