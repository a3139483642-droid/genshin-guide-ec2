import React,{useEffect,useState} from 'react';
import {Routes,Route,Link,useNavigate,useParams,useSearchParams,useLocation} from 'react-router-dom';
import {api} from './api';
import {GameIcon} from './game-icons.jsx';
import {Admin,Editor,ImportPage,OwnerPage} from './admin';
import {AppContext,useApp,useLoad,Loading,Empty,Field,Button,palettes} from './shared.jsx';
import {ImageGuideBody} from './image-guide.jsx';
import {Catalog,Header,Footer} from './catalog.jsx';
import {ElementSigil} from './ui-icons.jsx';
import {TravelFigure,travelArt} from './travel-art.jsx';

function ScrollOnNavigation(){
 const {pathname,hash}=useLocation(),{settings}=useApp();
 useEffect(()=>{if(!hash)window.scrollTo({top:0,left:0,behavior:'instant'});},[pathname]);
 useEffect(()=>{
  if(pathname.startsWith('/characters/'))return;
  const title=pathname.startsWith('/admin')?'管理工作台':({'/':'原神角色攻略','/login':'旅人登录','/setup':'创建手册','/account':'我的账号','/about':'关于这本手册'}[pathname]||'未收录的页面');
  document.title=title+' · '+settings.name;
 },[pathname,settings.name]);
 return null;
}
export default function App(){const [user,setUser]=useState(null),[ready,setReady]=useState(false),[status,setStatus]=useState(null),[settings,setSettings]=useState({name:'提瓦特旅行手册',description:'让每一次培养，都有迹可循。'}),[toast,setToast]=useState(null);useEffect(()=>{Promise.all([api('/me'),api('/status'),api('/settings')]).then(([me,s,config])=>{setUser(me.user);setStatus(s);setSettings(config);}).catch(e=>setToast({text:e.message,error:true})).finally(()=>setReady(true));},[]);useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),5000);return()=>clearTimeout(t);},[toast]);const notify=(text,error=false)=>setToast({text,error});
 return <AppContext.Provider value={{user,setUser,ready,status,setStatus,settings,setSettings,notify}}><ScrollOnNavigation/><a className="skip-link" href="#main">跳到主要内容</a><Header/><main id="main"><Routes><Route path="/" element={<Catalog/>}/><Route path="/characters/:id" element={<Character/>}/><Route path="/login" element={<Auth/>}/><Route path="/setup" element={<Auth setup/>}/><Route path="/about" element={<About/>}/><Route path="/account" element={<Account/>}/><Route path="/admin" element={<Admin/>}/><Route path="/admin/import" element={<ImportPage/>}/><Route path="/admin/editor/:id" element={<Editor/>}/><Route path="/admin/manage/:section" element={<OwnerPage/>}/><Route path="*" element={<div className="container"><Empty title="这一页尚未收录"><Link className="btn" to="/">返回角色图鉴</Link></Empty></div>}/></Routes></main><Footer/>{toast&&<div className={'toast '+(toast.error?'error':'')} role="status">{toast.text}</div>}</AppContext.Provider>;
}
function Atlas(){return <div className="atlas" aria-hidden="true"><svg viewBox="0 0 520 270" fill="none"><circle cx="277" cy="137" r="111" stroke="#bac9b5"/><circle cx="277" cy="137" r="91" stroke="#cdd6bf" strokeDasharray="2 8"/><path d="M277 13V262M151 137H403M189 49L365 225M189 225L365 49" stroke="#d3dbc7"/><path d="M275 36l10 85 50 22-52 8-8 89-10-85-50-12 51-18Z" stroke="#718d73" fill="#dfe6d4"/><path d="M33 219l93-78 41 31 57-61 54 50 44-31 132 89Z" fill="#d4dfce"/><path d="M24 242l108-55 71 24 88-71 39 43 49-17 108 76Z" fill="#96afa0"/><path d="M40 246l120-25 76 14 80-35 59 22 111 24" stroke="#729281"/><path d="M20 259H499" stroke="#bfcbbb"/><path d="M123 45l3 9 9 3-9 3-3 9-3-9-9-3 9-3ZM415 53l4 12 12 4-12 4-4 12-4-12-12-4 12-4Z" fill="#b59655"/></svg><span className="atlas-label">AN ATLAS OF EVERY JOURNEY</span></div>;}
function Character(){
 const {id}=useParams(),[params]=useSearchParams(),{data,error}=useLoad('/characters/'+id);
 const {settings}=useApp(),requested=params.get('plan');
 useEffect(()=>{if(data)document.title=data.character.name+'攻略 · '+settings.name;},[data,settings.name]);
 if(!data)return <div className="container"><Loading error={error}/></div>;
 const c=data.character;
 if(requested&&!data.plans.some(p=>p.id===requested))return <div className="container page"><Empty title="这份攻略暂时无法查看"><Link className="btn" to={'/characters/'+id}>查看角色攻略</Link></Empty></div>;
 const plans=[...data.plans].sort((a,b)=>Number(b.id===requested)-Number(a.id===requested)||Number(b.id===c.recommended_plan)-Number(a.id===c.recommended_plan)||new Date(b.updated_at||b.published_at)-new Date(a.updated_at||a.published_at));
 return <div className="container image-reader">
  <div className="breadcrumb"><Link to="/">角色图鉴</Link><span> / {c.name}</span></div>
  <header className="reader-heading" style={{'--character-tint':palettes[c.element]?.[0]}}>
   <div className="reader-avatar"><GameIcon kind="characters" name={c.name} eager/></div>
   <div><span className="eyebrow"><ElementSigil element={c.element}/> {c.element==='多'?'元素可切换':c.element+'元素'} · {c.weapon}</span><h1>{c.name}<span>角色攻略</span></h1></div>
   <Link className="reader-back" to="/">← 角色图鉴</Link>
  </header>
  {!plans.length?<Empty title="这位旅伴的攻略，正在等待补充"><p>发布后，攻略图片和作者评语会直接展示在这里。</p><Link className="btn" to="/">看看其他角色</Link></Empty>:<div className="image-guide-list">{plans.map(p=><Guide key={p.id} planId={p.id}/>)}</div>}
 </div>;
}
function Guide({planId}){
 const {data,error}=useLoad('/plans/'+planId),{notify}=useApp(),[discuss,setDiscuss]=useState(false);
 if(!data)return <Loading error={error}/>;
 const d=data.data;
 return <article className="image-guide-article" id={'guide-'+planId}>
  <header className="image-guide-heading"><h2>{d.title}</h2><span>{new Date(data.updatedAt).toLocaleDateString('zh-CN')} 更新</span></header>
  <ImageGuideBody data={d}/>
  <footer className="guide-credit"><p>图片作者：{d.imageAuthor||'未署名'} <span>·</span> 整理发布：{data.author}</p><p>{d.gameVersion&&d.gameVersion!=='来源未注明'?'适用版本：'+d.gameVersion:'版本未注明'}{d.source&&' · 来源：'+d.source}</p></footer>
  <div className="guide-bottom-actions"><details className="compact-discussion" onToggle={e=>setDiscuss(e.currentTarget.open)}><summary>读者讨论</summary>{discuss&&<Feedback plan={data}/>}</details><Button className="text-btn guide-share" onClick={async()=>{const url=new URL(location.href);url.searchParams.set('plan',planId);url.hash='';await navigator.clipboard.writeText(url.href);notify('攻略链接已复制');}}>分享攻略 ↗</Button></div>
 </article>;
}
function Feedback({plan}){
 const {user,notify}=useApp(),[page,setPage]=useState(1),{data:comments,error,reload}=useLoad('/plans/'+plan.id+'/comments?page='+page),[body,setBody]=useState(''),[reply,setReply]=useState(null);
 const inputId='comment-input-'+plan.id;
 function renderComment(c,isReply=false){return <article className={'comment '+(isReply?'reply':'')} key={c.id}>
  <div className="between"><strong>{c.display_name}</strong><span className="small muted">{new Date(c.created_at).toLocaleDateString('zh-CN')}</span></div><p className={c.status!=='visible'?'muted':''}>{c.body}</p>
  <div className="flex wrap">
   {!isReply&&user&&<button className="text-btn" onClick={()=>{setReply(c);document.getElementById(inputId)?.focus();}}>回复</button>}
   {c.status==='visible'&&user&&<Button className="text-btn" onClick={async()=>{const reason=prompt('请说明举报原因（2–500 字）');if(reason){await api('/comments/'+c.id+'/report',{method:'POST',body:{reason}});notify('举报已提交给站长');}}}>举报</Button>}
   {c.status==='visible'&&(user?.id===c.user_id||user?.role==='owner')&&<Button className="text-btn" onClick={async()=>{if(confirm('删除这条评论？')){await api('/comments/'+c.id,{method:'DELETE'});reload();}}}>删除</Button>}
  </div>{c.replies?.map(r=>renderComment(r,true))}
 </article>;}
 return <section className="reader-discussion" aria-label="读者讨论">
  {user?<form onSubmit={async e=>{e.preventDefault();try{await api('/plans/'+plan.id+'/comments',{method:'POST',body:{body,parentId:reply?.id,versionId:plan.versionId}});setBody('');setReply(null);reload();notify('评论已发布');}catch(err){notify(err.message,true);}}}>
   {reply&&<div className="notice">回复 {reply.display_name} <button type="button" className="text-btn" onClick={()=>setReply(null)}>取消回复</button></div>}
   <Field label="留下你的使用心得"><textarea id={inputId} required maxLength={1500} rows={3} value={body} onChange={e=>setBody(e.target.value)} placeholder="分享你的使用心得，或指出需要补充的地方…"/></Field><button className="btn" type="submit">发布{reply?'回复':'评论'}</button>
  </form>:<p className="small muted"><Link to="/login">登录后参与讨论 ↗</Link></p>}
  {!comments?<Loading error={error}/>:<>{comments.items.map(c=>renderComment(c))}{!comments.total&&<p className="muted small">还没有讨论，欢迎留下使用心得。</p>}{comments.total>15&&<div className="pagination"><button className="btn" disabled={page===1} onClick={()=>setPage(page-1)}>上一页</button><span>{page}</span><button className="btn" disabled={page*15>=comments.total} onClick={()=>setPage(page+1)}>下一页</button></div>}</>}
 </section>;
}
function Auth({setup=false}){const [register,setRegister]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const {setUser,status,setStatus}=useApp(),navigate=useNavigate();async function submit(e){e.preventDefault();setBusy(true);setError('');const f=new FormData(e.currentTarget);const body=Object.fromEntries(f);body.includeSample=f.get('includeSample')==='on';try{const out=await api(setup?'/setup':register?'/register':'/login',{method:'POST',body});setUser(out.user);if(setup)setStatus({...status,needsSetup:false});navigate(out.user.role==='user'?'/':'/admin');}catch(err){setError(err.message);}finally{setBusy(false);}}
const authArt=register||setup?travelArt.gathering:travelArt.moonlit;
return <div className="auth-shell"><div className="auth-decoration"><img className="auth-art" src={authArt.src} alt={authArt.alt} width={authArt.width} height={authArt.height} decoding="async"/><div className="auth-art-shade" aria-hidden="true"/><span>✧</span><div className="eyebrow">A NOTE FOR YOUR NEXT JOURNEY</div><h1>把每一份经验，<br/>留给下一段旅程。</h1><p>查阅攻略无需登录。登录后，你可以留下使用心得。<br/>攻略由受邀管理员整理与发布。</p><Atlas/></div><section className="panel auth-panel"><div className="eyebrow">{setup?'WELCOME, KEEPER':'WELCOME, TRAVELER'}</div><h2>{setup?'创建你的站长账号':register?'登记新的旅人':'欢迎回到旅行手册'}</h2><p className="muted small">{setup?'仅首次初始化创建唯一最高管理员。':register?'注册后可以参与攻略讨论。':'使用账号和密码登录。'}</p>{setup&&status&&!status.needsSetup?<div className="notice">站点已完成初始化。<Link to="/login">前往登录</Link></div>:<form onSubmit={submit}><Field label="账号"><input name="username" required autoComplete="username" minLength={3} maxLength={80} pattern="[a-zA-Z0-9_.@\-]+" placeholder="英文账号或邮箱"/></Field>{(setup||register)&&<Field label="显示名称"><input name="displayName" required maxLength={32} autoComplete="nickname" placeholder={setup?'手册站长':'旅人昵称'}/></Field>}<Field label="密码"><input name="password" type="password" required minLength={10} maxLength={128} autoComplete={setup||register?'new-password':'current-password'} placeholder="至少 10 位字符"/></Field>{setup&&<>{!status?.local&&<Field label="初始化密钥"><input name="setupKey" type="password" required placeholder="Netlify 环境变量 SETUP_KEY" autoComplete="off"/></Field>}<label className="check"><input type="checkbox" name="includeSample" defaultChecked/>添加一份标注清楚的功能示例攻略</label></>}{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn primary wide" disabled={busy}>{busy?'正在处理…':setup?'创建站点':register?'创建普通账号':'登录手册'} <span>→</span></button></form>}{!setup&&<div className="auth-switch"><button className="text-btn" onClick={()=>{setRegister(!register);setError('');}}>{register?'已有账号？返回登录':'还没有账号？注册旅人账号'}</button></div>}<Link className="small muted" to="/">← 返回角色图鉴</Link></section></div>;}
function Account(){const {user,setUser,ready,notify}=useApp(),navigate=useNavigate();if(!ready)return <Loading/>;if(!user)return <div className="container"><Empty title="请先登录"><Link className="btn primary" to="/login">登录</Link></Empty></div>;return <div className="narrow page"><div className="eyebrow">YOUR TRAVELER PROFILE</div><h1>你好，{user.displayName}</h1><p className="muted">{user.username} · {{user:'普通旅人',publisher:'发布管理员',owner:'最高管理员'}[user.role]}</p><TravelFigure art={travelArt.anniversary} className="account-memory" eager/><section className="panel"><h2>修改密码</h2><form onSubmit={async e=>{e.preventDefault();try{await api('/password',{method:'POST',body:Object.fromEntries(new FormData(e.currentTarget))});setUser(null);notify('密码已修改，请重新登录');navigate('/login');}catch(err){notify(err.message,true);}}}><Field label="原密码"><input name="currentPassword" type="password" required autoComplete="current-password"/></Field><Field label="新密码（至少 10 位）"><input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password"/></Field><button className="btn primary">保存新密码</button></form></section><Button className="btn danger" onClick={async()=>{await api('/logout',{method:'POST'});setUser(null);navigate('/');}}>退出登录</Button></div>;}
function About(){return <div className="narrow page prose about-page">
 <div className="eyebrow">A TRAVELER'S HANDBOOK</div>
 <h1>让每一次培养，<br/>都有迹可循。</h1>
 <p>提瓦特旅行手册是一个独立同人攻略站。选择角色，就能阅读完整攻略图片和作者评语。</p>
 <TravelFigure art={travelArt.gathering} className="about-cover" eager/>
 <section className="panel"><h2>怎样使用这本手册</h2><p>从角色图鉴选择旅伴，攻略图片会直接展示。同一角色的多份攻略依次排列，推荐攻略优先，其余按更新时间展示。</p><p>长图保持原比例，向下滑动即可阅读。点击图片可在当前页面放大查看，关闭后继续阅读；作者评语与署名在图片下方。</p></section>
 <section className="panel"><h2>内容与参与</h2><p>阅读无需登录，登录后可在攻略底部参与讨论。攻略由站长邀请的管理员上传图片、填写作者评语并发布，注册普通账号可参与讨论。</p><p>留意来源和适用版本。标有“功能示例”的攻略仅用于演示网站流程；“来源未注明”表示资料没有提供相应信息，不代表适用最新版本。</p></section>
 <section className="about-memories" aria-labelledby="companions-heading"><div className="eyebrow">MOMENTS WITH COMPANIONS</div><h2 id="companions-heading">一路同行，皆是值得珍藏的风景。</h2><div className="memories-grid"><TravelFigure art={travelArt.anniversary}/><TravelFigure art={travelArt.reunion}/></div></section>
 <section className="panel"><h2>隐私与版权</h2><p>网站保存你的账号、互动记录和登录会话。密码经过安全哈希处理。未发布图片保存在私有区，明确选入已发布攻略的图片可公开阅读。原始文档与历史导入资料默认私有。</p><p>未配置 OCR 或模型服务时，文件不会发往第三方识别平台。本站不代表游戏官方，游戏角色、武器、圣遗物的名称和图像归原权利人所有。内容问题可通过评论举报交给站长处理。</p></section>
 <Link className="btn primary" to="/">翻开角色图鉴 →</Link>
 </div>;}
