import React,{useEffect,useState,useContext,createContext} from 'react';
import {api} from './api';

export const AppContext=createContext();
export const useApp=()=>useContext(AppContext);
export const types={weapons:'武器推荐',artifacts:'圣遗物搭配',stats:'词条选择',talents:'天赋与命座',teams:'配队方案',rotation:'操作循环',materials:'培养路线',mechanics:'机制细节',notes:'补充说明'};
export const palettes={风:['#dce7da','#4d7867'],雷:['#e2ddeb','#776292'],草:['#e4e8ce','#7b8647'],水:['#dbe5e9','#5c7c90'],火:['#eddfd3','#9c705b'],岩:['#e9e2d0','#96824f'],冰:['#dfe8eb','#64838e'],多:['#e9e2d0','#96824f']};
export function useLoad(path,deps=[]){const [data,setData]=useState(null),[error,setError]=useState(''),[revision,refresh]=useState(0);useEffect(()=>{let alive=true;setError('');setData(null);api(path).then(d=>alive&&setData(d)).catch(e=>alive&&setError(e.message));return()=>{alive=false;};},[path,revision,...deps]);return {data,error,reload:()=>refresh(v=>v+1),setData};}
export function Loading({error}){return <div className="empty" role="status">{error?<><h2>暂时无法读取</h2><p>{error}</p><button className="btn" onClick={()=>location.reload()}>重新载入</button></>:<><span className="loading-compass">✧</span><p>正在翻开手册…</p></>}</div>;}
export function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>;}
export function Empty({title='还没有内容',children}){return <div className="empty"><span className="empty-mark">✧</span><h2>{title}</h2>{children}</div>;}
export function Button({children,onClick,...props}){const [busy,setBusy]=useState(false);const {notify}=useApp();return <button className="btn" {...props} disabled={busy||props.disabled} onClick={async e=>{setBusy(true);try{await onClick?.(e);}catch(err){notify(err.message,true);}finally{setBusy(false);}}}>{busy?'处理中…':children}</button>;}
