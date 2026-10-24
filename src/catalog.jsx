import React,{useEffect,useState} from 'react';
import {Link,NavLink,useSearchParams,useLocation} from 'react-router-dom';
import {useApp,useLoad,Loading,Empty,palettes} from './shared.jsx';
import {GameIcon} from './game-icons.jsx';
import {Icon,ElementSigil} from './ui-icons.jsx';
import {TravelMemories} from './travel-art.jsx';

export function Header(){
  const {user,settings}=useApp();
  const {pathname}=useLocation();
  return <header className="topbar">
    <Link className="brand" to="/" aria-label={settings.name+'首页'}><span className="brandmark"><Icon name="star" size={30}/></span><span><strong>{settings.name}</strong><small>TEYVAT · CHARACTER ARCHIVE</small></span></Link>
    <nav className="topnav" aria-label="主导航"><NavLink to="/" end className={({isActive})=>isActive||pathname.startsWith('/characters/')?'active':''}>角色图鉴</NavLink><NavLink to="/about" className="about-link">旅行指南</NavLink>{user&&user.role!=='user'&&<NavLink to="/admin">管理工作台</NavLink>}</nav>
    <div className="top-actions">{user?<Link className="account-link" to="/account" aria-label={'账号：'+user.displayName}><span className="avatar">{user.displayName.slice(0,1)}</span><span>{user.displayName}</span></Link>:<Link className="btn login-button" to="/login"><Icon name="user" size={16}/><span>登录 / 注册</span></Link>}</div>
  </header>;
}

export function Footer(){
  const {settings}=useApp();
  return <footer className="footer"><div className="footer-brand"><Icon name="star" size={28}/><div><strong>{settings.name}</strong><p>{settings.description}</p></div></div><div className="footer-note"><span>独立同人攻略站 · 非游戏官方网站<br/>游戏名称与图像归原权利人所有</span><Link to="/about">关于这本手册 <Icon name="diagonal" size={13}/></Link></div></footer>;
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
  function changePage(value){filter('page',String(value));document.getElementById('character-atlas')?.scrollIntoView({behavior:'smooth',block:'start'});}
  const filtered=Boolean(q||element||only);
  return <div className="catalog-page">
    <section className="journey-hero" aria-label="旅行手册介绍">
      <div className="journey-art"><img src="/art-library/03-inazuma.webp" alt="雷电将军与珊瑚宫心海，雷光与海潮交织的稻妻主视觉" width="2048" height="1152" fetchPriority="high" decoding="async"/></div>
      <div className="hero-constellation" aria-hidden="true"><span/><span/><span/><span/></div>
      <div className="container journey-content"><div className="journey-copy"><div className="journey-kicker"><span/> 在此，记下与旅伴的每一次成长</div><p className="hero-overline">TEYVAT CHARACTER ARCHIVE</p><h1>循着星光，<br/>与旅伴<span>再启程。</span></h1><div className="hero-rule" aria-hidden="true"><span/>✦</div><p>让每一种热爱，都有清晰的培养方向。<br/>查阅配装、探索队伍，把下一场冒险交给默契。</p><div className="journey-actions"><a href="#character-atlas" className="btn primary">探索角色图鉴 <Icon name="arrow" size={18}/></a><Link to="/about" className="hero-secondary">使用说明 <Icon name="diagonal" size={14}/></Link></div></div></div>
      <div className="hero-caption"><span className="hero-caption-line"/><span>INAZUMA / 稻妻</span><small>浮世的景色，愿与你一同珍藏。</small></div>
      <a className="hero-scroll" href="#character-atlas" aria-label="向下浏览角色图鉴"><span>探索更多</span><span className="scroll-diamond"><Icon name="arrow" size={16}/></span></a>
    </section>
    <div className="container catalog-inner">
    {status?.needsSetup&&<div className="setup-note"><Icon name="book" size={18}/><span>旅行手册已准备就绪。创建站长账号，开始整理你的第一份攻略。</span><Link to="/setup">初始化站点 ↗</Link></div>}
    <div className="handbook-intro" aria-label="手册内容"><div><span className="feature-icon"><Icon name="swords" size={23}/></span><span><small>01 / EQUIPMENT</small><strong>配装，找到合适的答案</strong></span></div><div><span className="feature-icon"><Icon name="people" size={23}/></span><span><small>02 / COMPANIONS</small><strong>配队，让旅伴彼此照亮</strong></span></div><div><span className="feature-icon"><Icon name="book" size={23}/></span><span><small>03 / GROWTH</small><strong>培养，走好成长的每一步</strong></span></div></div>
    <section className="catalog-body" id="character-atlas" aria-labelledby="atlas-heading">
      <div className="atlas-heading"><div className="section-ornament" aria-hidden="true"><span/><Icon name="star" size={25}/><span/></div><div className="eyebrow">CHARACTER ARCHIVE</div><h2 id="atlas-heading">世间万象，皆有旅伴</h2><p>选择一位角色，直接阅读攻略图片与作者评语。</p></div>
      <div className="catalog-tools"><div className="filters" aria-label="元素筛选">{['','风','岩','雷','草','水','火','冰'].map(e=><button key={e} className={'filter '+(element===e?'active':'')} data-element={e} aria-pressed={element===e} onClick={()=>filter('element',e)}>{e?<><ElementSigil element={e}/><span>{e}</span></>:<><Icon name="compass" size={17}/><span>全部</span></>}</button>)}</div><label className="searchbox"><Icon name="search" size={18}/><input className="search" aria-label="搜索角色" placeholder="寻找角色、别名或武器…" value={input} onChange={e=>setInput(e.target.value)}/>{input&&<button className="search-clear" aria-label="清空搜索" onClick={()=>setInput('')}><Icon name="close" size={14}/></button>}</label></div>
      <div className="catalog-meta"><div className="catalog-count"><span className="count-dot"/> {data?<>已收录 <strong>{data.total}</strong> 位角色</>:'正在查找旅伴…'}{element&&<span className="result-filter">{element}元素</span>}{filtered&&<button className="reset-filters" onClick={clearFilters}>重置筛选 <Icon name="close" size={12}/></button>}</div><label className="check ready-toggle"><input type="checkbox" checked={only} onChange={e=>filter('ready',e.target.checked?'true':'')}/>只看已有攻略</label></div>
      {!data?<Loading error={error}/>:<div className="character-grid">{data.items.map((c,i)=><CharacterCard key={c.id} c={c} index={(data.page-1)*24+i}/>)}{!data.items.length&&<Empty title="还没有找到这位旅伴"><p>试试其他名称，或切换元素继续探索。</p><button className="btn primary" onClick={clearFilters}>重置筛选，重新探索</button></Empty>}</div>}
      {data?.total>24&&<div className="pagination"><button className="btn" disabled={page===1} onClick={()=>changePage(page-1)}>上一页</button><span>第 {page} 页 / 共 {Math.ceil(data.total/24)} 页</span><button className="btn" disabled={page*24>=data.total} onClick={()=>changePage(page+1)}>下一页</button></div>}
      <div className="catalog-footnote"><span><Icon name="star" size={13}/> 每一种玩法，都有值得记录的可能。</span><span>长图直接阅读 · 作者评语与来源随图展示</span></div>
    </section>
    <TravelMemories/>
    </div>
  </div>;
}

function CharacterCard({c,index}){
  const [tint,tone]=palettes[c.element]||palettes.风;
  return <Link to={'/characters/'+c.id} className="char-card" style={{'--tint':tint,'--tone':tone}} aria-label={c.name+'，'+(c.plan_count?c.plan_count+'份图片攻略':'攻略待补充')}>
    <div className="char-art"><span className="element"><ElementSigil element={c.element} size={15}/>{c.element==='多'?'元素可切换':c.element+'元素'}</span><span className="card-index">{String(index+1).padStart(2,'0')}</span><span className="card-orbit" aria-hidden="true"/><GameIcon kind="characters" name={c.name} eager={index%24<4}/><span className="art-note">{c.title}</span></div>
    <div className="char-info"><div className="between"><h3>{c.name}</h3><span className="weapon-type">{c.weapon}</span></div><div className="card-tags">{c.tags.map(t=><span key={t}>{t}</span>)}</div><div className="char-bottom"><span className={c.plan_count?'ready-text':''}><i/>{c.plan_count?`${c.plan_count} 份图片攻略`:'攻略待补充'}</span><span className="card-open"><Icon name="arrow" size={17}/></span></div></div>
  </Link>;
}
