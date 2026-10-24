import React,{useEffect,useState} from 'react';
import {Link,NavLink,useSearchParams} from 'react-router-dom';
import {useApp,useLoad,Loading,Empty,palettes} from './shared.jsx';
import {GameIcon} from './game-icons.jsx';
import {Icon,ElementSigil} from './ui-icons.jsx';

export function Header(){
  const {user,settings}=useApp();
  return <header className="topbar">
    <Link className="brand" to="/" aria-label={settings.name+'首页'}><span className="brandmark"><Icon name="compass" size={30}/></span><span><strong>{settings.name}</strong><small>TEYVAT FIELD NOTES</small></span></Link>
    <nav className="topnav" aria-label="主导航"><NavLink to="/" end><Icon name="book" size={16}/>角色图鉴</NavLink><NavLink to="/about" className="about-link">手册说明</NavLink>{user&&user.role!=='user'&&<NavLink to="/admin">管理工作台</NavLink>}</nav>
    <div className="top-actions">{user?<Link className="account-link" to="/account" aria-label={'账号：'+user.displayName}><span className="avatar">{user.displayName.slice(0,1)}</span><span>{user.displayName}</span></Link>:<Link className="btn login-button" to="/login"><Icon name="user" size={16}/><span>登录 / 注册</span></Link>}</div>
  </header>;
}

export function Footer(){
  const {settings}=useApp();
  return <footer className="footer"><div className="footer-brand"><Icon name="compass" size={24}/><div><strong>{settings.name}</strong><p>{settings.description}</p></div></div><div className="footer-note"><span>独立同人项目 · 游戏名称与图像归原权利人</span><Link to="/about">关于这本手册 <Icon name="diagonal" size={13}/></Link></div></footer>;
}

export function Catalog(){
  const [params,setParams]=useSearchParams();
  const q=params.get('q')||'',element=params.get('element')||'',only=params.get('ready')==='true',page=Number(params.get('page'))||1;
  const [input,setInput]=useState(q);
  useEffect(()=>{const t=setTimeout(()=>{if(input!==q)filter('q',input);},250);return()=>clearTimeout(t);},[input,q,params.toString()]);
  useEffect(()=>setInput(q),[q]);
  const {data,error}=useLoad('/characters?'+params.toString());
  const {status}=useApp();
  function filter(key,value){const next=new URLSearchParams(params);value?next.set(key,value):next.delete(key);if(key!=='page')next.delete('page');setParams(next,{replace:true});}
  function clearFilters(){setInput('');setParams({});}
  const filtered=Boolean(q||element||only);
  return <div className="container catalog-page">
    {status?.needsSetup&&<div className="setup-note"><span>欢迎打开行旅手册。创建站长账号，开始整理第一份攻略。</span><Link to="/setup">初始化站点 ↗</Link></div>}
    <section className="journey-hero" aria-label="行旅手册介绍">
      <div className="journey-copy"><div className="journey-kicker"><span/> 写给每一位热爱提瓦特的旅行者</div><h1>每一位旅伴，<br/>都值得<span>好好培养。</span></h1><p>从第一把武器，到默契的四人队伍。<br/>把探索的热爱，变成每一步清晰的培养方向。</p><div className="journey-actions"><a href="#character-atlas" className="btn primary">翻开角色手册 <Icon name="arrow" size={18}/></a><span>配装 · 配队 · 培养</span></div><div className="journey-signature"><Icon name="star" size={14}/><span>与旅伴同行，向更远的风景出发。</span></div></div>
      <div className="journey-art"><img src="/images/summer-journey.jpg" alt="万叶、莫娜、辛焱与菲谢尔在海岛上空展开冒险" width="3840" height="2160" fetchPriority="high"/><div className="journey-image-label"><span>THE JOURNEY CONTINUES</span><strong>下一程，依然与你。</strong></div><span className="art-corner" aria-hidden="true"><Icon name="compass" size={35}/></span></div>
    </section>
    <div className="handbook-intro" aria-label="手册内容"><div><Icon name="swords"/><span><strong>找到合适的配装</strong><small>武器与圣遗物，一目了然</small></span></div><div><Icon name="people"/><span><strong>组成默契的队伍</strong><small>角色搭配与操作循环</small></span></div><div><Icon name="book"/><span><strong>走好每一步培养</strong><small>天赋、词条与养成路线</small></span></div><Link to="/about">认识这本手册 <Icon name="diagonal" size={15}/></Link></div>
    <section className="catalog-body" id="character-atlas" aria-labelledby="atlas-heading">
      <div className="atlas-heading"><div><div className="eyebrow">THE CHARACTER ATLAS <span>／ 角色图鉴</span></div><h2 id="atlas-heading">寻找你的下一位旅伴<span className="heading-star" aria-hidden="true">✧</span></h2></div><p>以角色为起点，找到适合自己的玩法。</p></div>
      <div className="catalog-tools"><div className="filters" aria-label="元素筛选">{['','风','岩','雷','草','水','火','冰'].map(e=><button key={e} className={'filter '+(element===e?'active':'')} data-element={e} aria-pressed={element===e} onClick={()=>filter('element',e)}>{e?<><ElementSigil element={e}/><span>{e}</span></>:<><Icon name="compass" size={17}/><span>全部</span></>}</button>)}</div><label className="searchbox"><Icon name="search" size={18}/><input className="search" aria-label="搜索角色" placeholder="寻找角色、别名或武器…" value={input} onChange={e=>setInput(e.target.value)}/>{input&&<button className="search-clear" aria-label="清空搜索" onClick={()=>setInput('')}><Icon name="close" size={14}/></button>}</label></div>
      <div className="catalog-meta"><div className="catalog-count"><span className="count-dot"/> {data?<>找到 <strong>{data.total}</strong> 位旅伴</>:'正在查找旅伴…'}{element&&<span className="result-filter">{element}元素</span>}{filtered&&<button className="reset-filters" onClick={clearFilters}>重置筛选 <Icon name="close" size={12}/></button>}</div><label className="check ready-toggle"><input type="checkbox" checked={only} onChange={e=>filter('ready',e.target.checked?'true':'')}/>只看已有攻略</label></div>
      {!data?<Loading error={error}/>:<div className="character-grid">{data.items.map((c,i)=><CharacterCard key={c.id} c={c} index={i}/>)}{!data.items.length&&<Empty title="还没有找到这位旅伴"><p>试试其他名称，或切换元素继续探索。</p><button className="btn primary" onClick={clearFilters}>重置筛选，重新探索</button></Empty>}</div>}
      {data?.total>24&&<div className="pagination"><button className="btn" disabled={page===1} onClick={()=>filter('page',String(page-1))}>上一页</button><span>第 {page} 页 / 共 {Math.ceil(data.total/24)} 页</span><button className="btn" disabled={page*24>=data.total} onClick={()=>filter('page',String(page+1))}>下一页</button></div>}
      <div className="catalog-footnote"><span><Icon name="star" size={13}/> 每一种玩法，都有值得记录的可能。</span><span>方案独立呈现 · 阅读时请留意适用版本与来源</span></div>
    </section>
  </div>;
}

function CharacterCard({c,index}){
  const [tint,tone]=palettes[c.element]||palettes.风;
  return <Link to={'/characters/'+c.id} className="char-card" style={{'--tint':tint,'--tone':tone}} aria-label={c.name+'，'+(c.plan_count?c.plan_count+'份玩法方案':'攻略待补充')}>
    <div className="char-art"><span className="element"><ElementSigil element={c.element} size={15}/>{c.element}元素</span><span className="card-index">{String(index+1).padStart(2,'0')}</span><span className="card-orbit" aria-hidden="true"/><GameIcon kind="characters" name={c.name} eager={index<4}/><span className="art-note">{c.title}</span></div>
    <div className="char-info"><div className="between"><h3>{c.name}</h3><span className="weapon-type">{c.weapon}</span></div><div className="card-tags">{c.tags.map(t=><span key={t}>{t}</span>)}</div><div className="char-bottom"><span className={c.plan_count?'ready-text':''}><i/>{c.plan_count?`${c.plan_count} 份玩法方案`:'攻略待补充'}</span><span className="card-open"><Icon name="arrow" size={17}/></span></div></div>
  </Link>;
}
