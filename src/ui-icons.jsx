import React from 'react';

export function Icon({name, size=20, ...props}) {
  const paths = {
    compass: <><circle cx="12" cy="12" r="9"/><path d="m16 8-2.6 5.4L8 16l2.6-5.4L16 8ZM12 1v2m0 18v2M1 12h2m18 0h2"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    diagonal: <path d="M6 18 18 6M6 6h12v12"/>,
    book: <><path d="M12 6v15M3 3c4-1 6 0 9 3 3-3 5-4 9-3v15c-4-1-6 0-9 3-3-3-5-4-9-3V3Z"/><path d="m6 8 3 1m6 0 3-1M6 12l3 1m6 0 3-1"/></>,
    swords: <><path d="M4 3v5l12 12m-3-1 6-6m1-10v5L8 20m-3-7 6 6M2 22l4-4m12 0 4 4"/><path d="m4 3 5 1m11-1-5 1"/></>,
    people: <><circle cx="9" cy="8" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m1-16a3 3 0 0 1 0 6m1 3a6 6 0 0 1 4 6"/></>,
    star: <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]||paths.star}</svg>;
}

export function ElementSigil({element, size=18}) {
  const paths = {
    风: <><path d="M3 8h11a3 3 0 1 0-3-3M2 12h16a3 3 0 1 1-3 3M5 16h4a3 3 0 1 1-3 3"/></>,
    岩: <><path d="m12 2 8 10-8 10-8-10L12 2Zm0 5-4 5 4 5 4-5-4-5Z"/></>,
    雷: <path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>,
    草: <><path d="M20 3C8 1 2 10 7 16c5 6 15 0 13-13ZM5 21 17 7m-6 6v-4m0 4h5"/></>,
    水: <><path d="M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/></>,
    火: <path d="M13 2c2 7-5 7-3 12 2-1 3-2 4-5 5 4 7 8 3 12H7C0 16 5 10 8 7c-1 5 1 6 2 6-2-5 4-6 3-11Z"/>,
    冰: <><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M3.5 10l4-1-1-4m11 14-1-4 4-1M3.5 14l4 1-1 4m11-14-1 4 4 1"/></>,
  };
  return <svg className="element-sigil" data-element={element} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[element]||<><path d="m12 2 10 10-10 10L2 12 12 2ZM12 7v10M7 12h10"/></>}</svg>;
}
