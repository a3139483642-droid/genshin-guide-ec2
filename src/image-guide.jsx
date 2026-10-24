import React,{useEffect,useRef,useState} from 'react';

export function guideImageIds(data){
  return data.format==='image' ? data.imageIds||[] : [...new Set([...(data.imageIds||[]),...(data.modules||[]).filter(m=>!m.hidden).flatMap(m=>m.assetIds||[])])];
}

function ImageViewer({image,onClose}){
  const dialog=useRef(null),[original,setOriginal]=useState(false);
  useEffect(()=>{
    dialog.current.showModal();
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=previous;};
  },[]);
  return <dialog ref={dialog} className="image-viewer" aria-label="攻略图片放大查看" onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)dialog.current.close();}}>
    <div className="viewer-toolbar"><span>攻略原图</span><div className="flex"><button type="button" className="btn" onClick={()=>setOriginal(v=>!v)}>{original?'适应宽度':'原尺寸'}</button><button type="button" className="btn" autoFocus onClick={()=>dialog.current.close()}>关闭 ×</button></div></div>
    <div className={'viewer-scroll'+(original?' original-size':'')}><img src={image.src} alt={image.alt}/></div>
  </dialog>;
}

function GuideImage({id,index,title,onOpen}){
  const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const src='/api/assets/'+id,alt=title+' · 第 '+(index+1)+' 张攻略图';
  return <figure className="guide-image">
    {failed?<div className="image-fallback" role="alert"><p>图片暂时无法加载</p><button type="button" className="btn" onClick={()=>{setFailed(false);setAttempt(v=>v+1);}}>重新加载</button></div>:<button type="button" className="guide-image-button" aria-label={'放大查看：'+alt} onClick={()=>onOpen({src,alt})}>
      <img key={attempt} src={src+(attempt?'?retry='+attempt:'')} alt={alt} loading={index===0?'eager':'lazy'} decoding="async" onError={()=>setFailed(true)}/>
      <span className="image-zoom-hint">点击放大</span>
    </button>}
  </figure>;
}

export function ImageGuideBody({data}){
  const [image,setImage]=useState(null),ids=guideImageIds(data);
  const legacy=data.format!=='image'?(data.modules||[]).filter(m=>!m.hidden&&m.body?.trim()):[];
  const comment=data.authorComment||(ids.length?data.summary:'');
  return <>
    {ids.length>0&&<div className="guide-images">{ids.map((id,index)=><GuideImage key={id} id={id} index={index} title={data.title} onOpen={setImage}/>)}</div>}
    {legacy.length>0&&<div className="legacy-guide-text">{!ids.length&&data.summary&&<p>{data.summary}</p>}{legacy.map(m=><section key={m.id}><h3>{m.title}</h3><p>{m.body}</p></section>)}</div>}
    {comment&&<section className="author-comment"><div className="author-comment-label"><span>✦</span> 作者评语</div><p>{comment}</p></section>}
    {image&&<ImageViewer image={image} onClose={()=>setImage(null)}/>}
  </>;
}
