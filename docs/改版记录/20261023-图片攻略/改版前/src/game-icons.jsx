import React, {useState} from 'react';
import {resolveGameIcon, resolveGameIcons} from './game-icons';

export function GameIcon({kind, name, entry = resolveGameIcon(kind, name), className = '', eager = false}) {
  const [failedIcon, setFailedIcon] = useState('');
  const available = entry?.icon && entry.icon !== failedIcon;
  return <span className={`game-icon game-icon--${kind} ${className}`} data-rarity={entry?.rarity}>
    {available ? <img src={entry.icon} alt={`${entry.name}${kind === 'characters' ? '头像' : '图标'}`}
      width="256" height="256" loading={eager ? 'eager' : 'lazy'} decoding="async"
      onError={() => setFailedIcon(entry.icon)}/>
      : <span className="game-icon-fallback" role="img" aria-label={`${name || '此条目'}的图标待补充`}>
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">{kind === 'characters'
          ? <><circle cx="24" cy="17" r="8"/><path d="M9 42v-5a15 15 0 0 1 30 0v5"/></>
          : <><path d="m24 5 19 19-19 19L5 24Z"/><path d="M16 24h16M24 16v16"/></>}</svg>
      </span>}
  </span>;
}

export function GameIcons({kind, name, className = ''}) {
  const entries = resolveGameIcons(kind, name);
  return <span className={`game-icon-group ${className}`}>
    {entries.length ? entries.map(entry => <GameIcon key={entry.icon} kind={kind} name={entry.name} entry={entry}/>)
      : <GameIcon kind={kind} name={name}/>}
  </span>;
}
