import React,{useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {api} from './api';
import {useApp,Loading,Field} from './shared.jsx';
import {ImageGuideBody,guideImageIds} from './image-guide.jsx';

const blank=()=>({title:'',format:'image',imageIds:[],imageAuthor:'',authorComment:'',gameVersion:'来源未注明',summary:'',source:'',modules:[]});
function normalize(data){
  const ids=guideImageIds(data);
  const onlyImages=ids.length>0&&!(data.modules||[]).some(m=>!m.hidden&&m.body?.trim());
  return {...blank(),...data,format:data.format==='image'||onlyImages?'image':'legacy',imageIds:ids,modules:(data.modules||[]).map(m=>m.hidden?m:{...m,assetIds:[]}).filter(m=>m.body?.trim()||m.assetIds?.length),authorComment:data.authorComment||(ids.length?data.summary:'')||''};
}

export function ImageEditor({Shell}){
  const {id='new'}=useParams(),[params]=useSearchParams(),importId=params.get('import')||params.get('job');
  const {user,notify}=useApp(),navigate=useNavigate();
  const [characters,setCharacters]=useState([]),[characterId,setCharacterId]=useState(''),[guide,setGuide]=useState(blank),[plan,setPlan]=useState(null);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[progress,setProgress]=useState(''),[dragging,setDragging]=useState(false);
  const [sourceJob,setSourceJob]=useState(null),[legacyText,setLegacyText]=useState('');
  const fileInput=useRef(null),uploadLock=useRef(false),dirtyRef=useRef(false),titleEdited=useRef(false);
  const readOnly=user?.role==='publisher'&&!!plan?.public_version;
  const selected=characters.find(c=>c.id===characterId);
  useEffect(()=>{
    let live=true;
    Promise.all([api('/admin/dashboard'),id==='new'?null:api('/admin/plans/'+id),importId?api('/admin/imports/'+importId):null]).then(([dash,p,job])=>{
      if(!live)return;
      setCharacters(dash.characters);
      if(p){setPlan(p);setCharacterId(p.character_id);setGuide(normalize(p.draft));titleEdited.current=true;}
      else if(job){
        setSourceJob(job);
        const modules=job.result?.modules||[],imageIds=job.result?.imageIds||[];
        setGuide(normalize({...blank(),format:'legacy',imageIds,modules,source:job.filename?'导入文件：'+job.filename:'',importId:job.id}));
        setLegacyText(job.text||'');
        const candidates=dash.characters.filter(c=>[c.name,...c.aliases.split(' ')].some(n=>n&&job.text?.includes(n)));
        if(candidates.length===1){setCharacterId(candidates[0].id);setGuide(g=>({...g,title:candidates[0].name+'攻略'}));}
      }
      setReady(true);
    }).catch(e=>{if(live)setError(e.message);});
    return()=>{live=false;};
  },[id,importId]);
  useEffect(()=>{dirtyRef.current=dirty;},[dirty]);
  useEffect(()=>{
    const warn=e=>{if(dirtyRef.current||uploadLock.current){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[]);

  function update(values){setGuide(g=>({...g,...values}));setDirty(true);setError('');}
  function chooseCharacter(value){
    setCharacterId(value);setDirty(true);setError('');
    if(!titleEdited.current){const c=characters.find(x=>x.id===value);setGuide(g=>({...g,title:c?c.name+'攻略':''}));}
  }
  async function upload(files,replaceIndex=null){
    if(uploadLock.current||readOnly||busy)return;
    const list=Array.from(files||[]);
    if(!list.length)return;
    if(replaceIndex===null&&guide.imageIds.length+list.length>20){setError('每份攻略最多 20 张图片，请分成多份攻略发布。');return;}
    const invalid=list.find(f=>!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>3*1024*1024);
    if(invalid){setError(invalid.size>3*1024*1024?'“'+invalid.name+'”超过 3 MB，请另存为体积更小的清晰图片后上传。':'请选择 PNG、JPEG 或 WebP 图片。');return;}
    uploadLock.current=true;setUploading(true);setError('');
    try{
      for(const [index,file] of list.entries()){
        setProgress('正在上传 '+(index+1)+' / '+list.length+'：'+file.name);
        const form=new FormData();form.append('file',file);
        const out=await api('/admin/images',{method:'POST',body:form});
        setGuide(g=>({...g,imageIds:replaceIndex===null?[...g.imageIds,out.id]:g.imageIds.map((a,i)=>i===replaceIndex?out.id:a)}));
        setDirty(true);
      }
    }catch(e){setError('上传未完成，已上传的图片已保留。'+e.message);}
    finally{uploadLock.current=false;setUploading(false);setProgress('');}
  }
  function move(from,to){
    const ids=[...guide.imageIds];if(to<0||to>=ids.length)return;
    const [item]=ids.splice(from,1);ids.splice(to,0,item);update({imageIds:ids});
  }
  async function persist(publish){
    if(busy||uploadLock.current||readOnly)return;
    if(!characterId){setError('请先选择所属角色。');return;}
    if(guide.format==='image'&&!guide.imageIds.length){setError('请至少上传一张攻略图片。');return;}
    setBusy(true);setError('');
    try{
      const data={...guide,title:guide.title.trim()||(selected?.name||'角色')+'攻略',gameVersion:guide.gameVersion.trim()||'来源未注明',summary:guide.format==='image'?guide.authorComment:guide.summary};
      // Old unrecognized text remains editable without the original module organizer.
      if(data.format==='legacy'&&!data.modules.length&&legacyText.trim())data.modules=[{id:'legacy-text',type:'notes',title:'攻略正文',body:legacyText,source:'导入资料',hidden:false,assetIds:[]}];
      let saved=plan;
      if(!saved){
        const out=await api('/admin/plans',{method:'POST',body:{characterId,data}});
        saved={id:out.id,revision:out.revision||1,draft:data,public_version:null};setPlan(saved);
      }else if(dirty){
        const result=await api('/admin/plans/'+saved.id,{method:'PUT',body:{data,revision:saved.revision}});
        saved={...saved,revision:result.revision,draft:data};
      }
      setPlan(saved);setGuide(data);setDirty(false);dirtyRef.current=false;
      if(publish){
        await api('/admin/plans/'+saved.id+'/publish',{method:'POST',body:{revision:saved.revision,confirmed:true}});
        notify('攻略已发布');navigate('/characters/'+characterId+'?plan='+saved.id);
      }else{notify('草稿已保存');if(id==='new')navigate('/admin/editor/'+saved.id);}
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  }

  return <Shell title={readOnly?'查看攻略':'发布图片攻略'} subtitle={readOnly?'这份攻略已发布，由站长维护更新。':'选好角色，上传图片，写下作者评语。'}>
    {!ready?<Loading error={error}/>:<form className="image-editor" onSubmit={e=>{e.preventDefault();persist(true);}}>
      {sourceJob&&['queued','processing'].includes(sourceJob.status)?<div className="notice">原导入任务仍在处理中。<Link to="/admin/import">直接上传图片</Link>，或稍后重新载入本页。</div>:null}
      <fieldset disabled={busy||uploading||readOnly} className="image-editor-fields">
        <section className="image-editor-info"><div className="grid2">
          <Field label="所属角色"><select value={characterId} required disabled={!!plan||readOnly} onChange={e=>chooseCharacter(e.target.value)}><option value="">选择角色</option>{characters.map(c=><option key={c.id} value={c.id}>{c.name}{c.visible?'':'（隐藏）'}</option>)}</select></Field>
          <Field label="攻略标题"><input value={guide.title} maxLength={100} placeholder={selected?selected.name+'攻略':'选角色后自动填写'} onChange={e=>{titleEdited.current=true;update({title:e.target.value});}}/></Field>
        </div></section>
        <section className="image-upload-section">
          <div className="between"><h2>攻略图片 <small>{guide.imageIds.length?guide.imageIds.length+' / 20':''}</small></h2><span className="small muted">按下方顺序展示</span></div>
          {!readOnly&&<div className={'image-dropzone'+(dragging?' dragging':'')} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);upload(e.dataTransfer.files);}}>
            <span className="upload-symbol" aria-hidden="true">↑</span><strong>把攻略图片拖到这里</strong><span className="small muted">PNG / JPEG / WebP · 每张最多 3 MB · 保留原图</span>
            <button type="button" className="btn" onClick={()=>fileInput.current.click()}>选择图片</button>
            <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/webp" aria-label="上传攻略图片" className="visually-hidden" onChange={e=>{upload(e.target.files);e.target.value='';}}/>
          </div>}
          {guide.imageIds.length>0&&<ol className="image-upload-list">{guide.imageIds.map((a,i)=><li key={a}><span className="upload-order">{String(i+1).padStart(2,'0')}</span><img src={'/api/assets/'+a} alt={'攻略图片 '+(i+1)}/><span className="upload-image-name">第 {i+1} 张</span>{!readOnly&&<div className="upload-item-actions">
            <button type="button" className="text-btn" aria-label={'上移第 '+(i+1)+' 张'} disabled={i===0} onClick={()=>move(i,i-1)}>上移</button>
            <button type="button" className="text-btn" aria-label={'下移第 '+(i+1)+' 张'} disabled={i===guide.imageIds.length-1} onClick={()=>move(i,i+1)}>下移</button>
            <label className="text-btn replace-image">替换<input type="file" accept="image/png,image/jpeg,image/webp" aria-label={'替换第 '+(i+1)+' 张'} onChange={e=>{upload(Array.from(e.target.files).slice(0,1),i);e.target.value='';}}/></label>
            <button type="button" className="text-btn danger-text" onClick={()=>update({imageIds:guide.imageIds.filter(x=>x!==a)})}>移除</button>
          </div>}</li>)}</ol>}
          {uploading&&<p role="status" className="upload-progress">{progress}</p>}
        </section>
        <section className="image-editor-copy">
          <Field label="图片作者（选填）"><input maxLength={100} value={guide.imageAuthor} onChange={e=>update({imageAuthor:e.target.value})} placeholder="填写原图作者的署名"/></Field>
          <Field label="作者评语（选填）"><textarea rows={4} maxLength={6000} value={guide.authorComment} onChange={e=>update({authorComment:e.target.value})} placeholder="补充适用玩法、使用心得，或图片中需要说明的地方…"/></Field>
          <details className="image-extra-fields"><summary>版本与来源（选填）</summary><div className="grid2"><Field label="适用版本"><input maxLength={100} value={guide.gameVersion==='来源未注明'?'':guide.gameVersion} onChange={e=>update({gameVersion:e.target.value})} placeholder="未填写则显示版本未注明"/></Field><Field label="来源说明"><input maxLength={6000} value={guide.source} onChange={e=>update({source:e.target.value})} placeholder="原作者主页、原帖链接或补充说明"/></Field></div></details>
          {guide.format==='legacy'&&<details className="image-extra-fields" open><summary>原有文字内容</summary>{guide.modules.length?guide.modules.map((m,i)=><Field label={m.title+(m.hidden?'（已隐藏）':'')} key={m.id}><textarea rows={4} maxLength={6000} value={m.body} onChange={e=>update({modules:guide.modules.map((n,j)=>j===i?{...n,body:e.target.value}:n)})}/></Field>):<Field label="攻略正文"><textarea rows={10} maxLength={6000} value={legacyText} onChange={e=>{setLegacyText(e.target.value);setDirty(true);}}/></Field>}</details>}
        </section>
      </fieldset>
      {error&&<p className="form-error image-editor-error" role="alert">{error}</p>}
      {!readOnly&&<div className="image-editor-actions"><span className="small muted">{uploading?'图片上传中…':dirty?'有未保存的修改':'可直接发布，或保存草稿稍后继续'}</span><div className="flex"><button type="button" className="btn" disabled={busy||uploading} onClick={()=>persist(false)}>保存草稿</button><button type="submit" className="btn primary" disabled={busy||uploading||!!plan?.public_version&&!dirty}>{busy?'正在保存…':plan?.public_version?dirty?'更新发布':'已发布':'发布攻略'}</button></div></div>}
      {(guide.imageIds.length>0||guide.modules.length>0)&&<details className="inline-guide-preview"><summary>查看展示效果</summary><div className="preview-caption">{guide.title||(selected?selected.name+'攻略':'攻略预览')}</div><ImageGuideBody data={guide}/><p className="guide-byline">图片作者：{guide.imageAuthor||'未署名'} · 整理发布：{user.displayName}</p></details>}
    </form>}
  </Shell>;
}
