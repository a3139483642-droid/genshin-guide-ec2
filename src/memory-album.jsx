import React,{useEffect,useRef,useState} from 'react';
import {api} from './api';
import {useApp,useLoad,Loading,Empty,Field,Button} from './shared.jsx';
import './memory-album.css';

const endpoint='/owner/memories';
const imageUrl=photo=>'/api'+endpoint+'/'+photo.id+'/image';
const sizeLabel=bytes=>bytes<1024*1024?(bytes/1024).toFixed(1)+' KB':(bytes/1024/1024).toFixed(1)+' MB';
const dateLabel=date=>new Date(date).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'});

function MemoryViewer({photo,onClose,onSaved,onDelete,onMove,canPrevious,canNext}){
  const dialog=useRef(null),[title,setTitle]=useState(photo.title),[caption,setCaption]=useState(photo.caption),[saving,setSaving]=useState(false),[failed,setFailed]=useState(false);
  const {notify}=useApp();
  useEffect(()=>{
    dialog.current.showModal();
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=previous;};
  },[]);
  useEffect(()=>{setTitle(photo.title);setCaption(photo.caption);setFailed(false);},[photo.id]);
  async function save(event){
    event.preventDefault();setSaving(true);
    try{const updated=await api(endpoint+'/'+photo.id,{method:'PATCH',body:{title,caption}});onSaved(updated);notify('照片备注已保存');}
    catch(error){notify(error.message,true);}
    finally{setSaving(false);}
  }
  return <dialog ref={dialog} className="memory-viewer" aria-labelledby="memory-viewer-title" onClose={onClose} onClick={event=>{if(event.target===event.currentTarget)dialog.current.close();}}>
    <div className="memory-viewer-bar"><span>✦ 记忆相簿 <span className="memory-private">仅站长可见</span></span><button type="button" className="btn" autoFocus onClick={()=>dialog.current.close()}>关闭 ×</button></div>
    <div className="memory-viewer-body">
      <div className="memory-original">{failed?<div role="alert"><p>图片暂时无法读取，请关闭后重试。</p></div>:<img key={photo.id} src={imageUrl(photo)} alt={photo.title} onError={()=>setFailed(true)}/>}</div>
      <div className="memory-details"><div className="eyebrow">A MOMENT TO KEEP</div><h2 id="memory-viewer-title">{photo.title}</h2><p className="muted small">存于 {dateLabel(photo.created_at)} · {sizeLabel(photo.size)}</p>
        <form onSubmit={save}><Field label="照片标题"><input value={title} onChange={event=>setTitle(event.target.value)} required maxLength={100}/></Field><Field label="写下这一刻"><textarea value={caption} onChange={event=>setCaption(event.target.value)} placeholder="那天的风景、同行的人，或一句想留下的话…" maxLength={1000} rows={5}/></Field><button className="btn primary" disabled={saving}>{saving?'保存中…':'保存备注'}</button></form>
        <p className="memory-filename small muted">原文件：{photo.filename}</p><div className="flex wrap"><a className="btn" href={imageUrl(photo)+'?download=1'} download>下载原图 ↓</a><Button className="btn danger" disabled={saving} onClick={()=>onDelete(photo)}>删除照片</Button></div>
      </div>
    </div>
    <div className="memory-viewer-nav"><button type="button" className="btn" disabled={!canPrevious||saving} onClick={()=>onMove(-1)}>← 上一张</button><span className="small muted">保留每一次值得记住的旅程</span><button type="button" className="btn" disabled={!canNext||saving} onClick={()=>onMove(1)}>下一张 →</button></div>
  </dialog>;
}

export function MemoryAlbum(){
  const {notify}=useApp(),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(1),[viewing,setViewing]=useState(null),[uploading,setUploading]=useState(false),[progress,setProgress]=useState(null),[failures,setFailures]=useState([]),[dragging,setDragging]=useState(false);
  const {data,error,reload}=useLoad(endpoint+'?'+new URLSearchParams({q:search,page:String(page)}));
  const input=useRef(null),uploadLock=useRef(false);
  useEffect(()=>{if(data&&page>1&&!data.items.length)setPage(Math.max(1,Math.ceil(data.total/data.pageSize)));},[data,page]);
  async function uploadFiles(files){
    if(uploadLock.current||!files.length)return;
    uploadLock.current=true;setUploading(true);setFailures([]);
    let succeeded=0;const errors=[];
    try{
      for(let index=0;index<files.length;index++){
        const file=files[index];setProgress({current:index+1,total:files.length,name:file.name});
        if(!/\.(png|jpe?g|webp)$/i.test(file.name)){errors.push(file.name+'：仅支持 PNG、JPEG、WebP');continue;}
        if(!file.size||file.size>3*1024*1024){errors.push(file.name+'：图片不能为空或超过 3 MB');continue;}
        const body=new FormData();body.append('file',file);
        try{await api(endpoint,{method:'POST',body});succeeded++;}catch(error){errors.push(file.name+'：'+error.message);}
      }
      setFailures(errors);
      if(succeeded){setQuery('');setSearch('');setPage(1);reload();notify('已珍藏 '+succeeded+' 张照片'+(errors.length?'，部分图片上传失败':''));}
      else if(errors.length)notify('图片未上传，请查看下方提示',true);
    }finally{setProgress(null);setUploading(false);uploadLock.current=false;if(input.current)input.current.value='';}
  }
  async function deletePhoto(photo){
    if(!window.confirm('确定删除「'+photo.title+'」？相簿中的这张照片将被移除。'))return;
    await api(endpoint+'/'+photo.id,{method:'DELETE'});setViewing(null);reload();notify('照片已删除');
  }
  const index=data?.items.findIndex(photo=>photo.id===viewing?.id)??-1;
  return <div className="memory-album">
    <section className="memory-intro"><div><div className="eyebrow">THE KEEPER'S PRIVATE COLLECTION</div><h2>把旅途，留在这里。</h2><p>一些风景，一些瞬间，一些只属于你的提瓦特记忆。</p><span className="memory-private">◇ 站长私藏 · 登录后方可查看</span></div><div className="memory-stamp" aria-hidden="true"><span>✧</span><small>MEMORIES<br/>OF TEYVAT</small></div></section>
    <section className={'memory-upload'+(dragging?' is-dragging':'')} aria-label="上传相簿照片" aria-busy={uploading} onDragOver={event=>{event.preventDefault();if(!uploading)setDragging(true);}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget))setDragging(false);}} onDrop={event=>{event.preventDefault();setDragging(false);void uploadFiles(Array.from(event.dataTransfer.files));}}>
      <span className="memory-upload-mark" aria-hidden="true">＋</span><div><h3>{uploading?'正在珍藏照片…':'为记忆添一张留影'}</h3><p className="small muted">可多选或拖入图片 · PNG / JPEG / WebP · 每张最多 3 MB</p></div><button type="button" className="btn primary" disabled={uploading} onClick={()=>input.current.click()}>＋ 选择照片</button><input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden disabled={uploading} aria-label="选择相簿图片" onChange={event=>void uploadFiles(Array.from(event.target.files))}/>
      {progress&&<div className="memory-progress" role="status"><span>{progress.current} / {progress.total} · {progress.name}</span><progress value={progress.current-1} max={progress.total}/></div>}
    </section>
    {failures.length>0&&<div className="memory-errors" role="alert"><strong>以下图片未能上传，可重新选择后重试：</strong><ul>{failures.map((failure,i)=><li key={i}>{failure}</li>)}</ul></div>}
    <div className="memory-toolbar"><div><h2>珍藏的瞬间 <span>{data?.total??'—'}</span></h2><p className="small muted">{search?'搜索结果 · ':''}{data?sizeLabel(data.bytes)+' · ':''}最近收藏的照片排在前面</p></div><form role="search" className="memory-search" onSubmit={event=>{event.preventDefault();setSearch(query.trim());setPage(1);}}><input type="search" aria-label="搜索相簿" placeholder="搜索标题、备注或文件名" value={query} maxLength={100} onChange={event=>setQuery(event.target.value)}/><button className="btn" type="submit">搜索</button>{search&&<button className="btn" type="button" onClick={()=>{setQuery('');setSearch('');setPage(1);}}>清除</button>}</form></div>
    {!data?<Loading error={error}/>:data.items.length?<><div className="memory-grid">{data.items.map(photo=><article className="memory-card" key={photo.id}><button type="button" className="memory-cover" aria-label={'查看照片：'+photo.title} onClick={()=>setViewing(photo)}><img src={imageUrl(photo)} alt={photo.title} loading="lazy" decoding="async"/><span>查看原图 ↗</span></button><div className="memory-card-copy"><h3>{photo.title}</h3>{photo.caption&&<p>{photo.caption}</p>}<div className="between small muted"><time dateTime={photo.created_at}>{dateLabel(photo.created_at)}</time><span>{sizeLabel(photo.size)}</span></div></div></article>)}</div>{data.total>data.pageSize&&<nav className="memory-pagination" aria-label="相簿分页"><button className="btn" disabled={page===1} onClick={()=>setPage(value=>value-1)}>← 上一页</button><span>第 {page} / {Math.ceil(data.total/data.pageSize)} 页</span><button className="btn" disabled={page*data.pageSize>=data.total} onClick={()=>setPage(value=>value+1)}>下一页 →</button></nav>}</>:<Empty title={search?'还没有找到这段记忆':'相簿的第一页，等你留下'}><p className="muted">{search?'试试其他标题或备注中的词。':'上传一张照片，收藏你的第一个瞬间。'}</p></Empty>}
    {viewing&&<MemoryViewer photo={viewing} onClose={()=>setViewing(null)} onSaved={updated=>{setViewing(updated);reload();}} onDelete={deletePhoto} canPrevious={index>0} canNext={index>=0&&index<data.items.length-1} onMove={offset=>setViewing(data.items[index+offset])}/>}
  </div>;
}
