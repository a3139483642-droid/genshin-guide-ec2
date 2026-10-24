import React from 'react';

export const travelArt={
  liyue:{src:'/art-library/02-liyue.webp',alt:'钟离与璃月角色的《迫近的客星》历史版本宣传插画',width:1980,height:1080,title:'璃月 · 迫近的客星',note:'历史版本留影'},
  inazuma:{src:'/art-library/03-inazuma.webp',alt:'雷电将军与珊瑚宫心海，雷光与海潮交织的稻妻插画',width:2048,height:1152,title:'稻妻 · 雷光与海潮'},
  fontaine:{src:'/art-library/04-fontaine.webp',alt:'芙宁娜、那维莱特与枫丹旅伴的《向深水中的晨星》主题插画',width:1950,height:1080,title:'枫丹 · 向深水中的晨星',note:'旅途主题留影'},
  anniversary:{src:'/art-library/05-anniversary.webp',alt:'旅伴们相聚花园的原神三周年纪念插画',width:1280,height:720,title:'花园里的相聚',note:'三周年纪念'},
  arlecchino:{src:'/art-library/06-arlecchino.webp',alt:'阿蕾奇诺与林尼、琳妮特、菲米尼的赤夜主题插画',width:2163,height:1197,title:'赤夜 · 两界为火，赤夜将熄',note:'旅途主题留影'},
  reunion:{src:'/art-library/07-reunion.webp',alt:'《你存在的时空》重逢主题插画，保留原有标题与画面',width:1332,height:600,title:'你存在的时空',note:'关于旅途，也关于重逢'},
  moonlit:{src:'/art-library/09-moonlit.webp',alt:'旅伴们相聚月夜的角色群像插画',width:1200,height:756,title:'月夜同行'},
  nodkrai:{src:'/art-library/10-nodkrai.webp',alt:'《终北的夜行诗》紫色夜空主题插画',width:2184,height:1200,title:'终北 · 终北的夜行诗',note:'旅途主题留影'},
  gathering:{src:'/art-library/11-gathering.webp',alt:'雷电将军、芙宁娜、纳西妲、温迪与钟离等旅伴的花园聚会插画',width:1697,height:955,title:'与旅伴，再一次相聚',note:'把共同走过的风景，收进旅行手册'},
};

// Captioned artwork retains the complete composition, including titles and marks.
export function TravelFigure({art,className='',eager=false}){
  return <figure className={'travel-figure '+className}>
    <img src={art.src} alt={art.alt} width={art.width} height={art.height} loading={eager?'eager':'lazy'} decoding="async"/>
    <figcaption><strong>{art.title}</strong>{art.note&&<span>{art.note}</span>}</figcaption>
  </figure>;
}

export function TravelMemories(){
  return <section className="travel-memories" aria-labelledby="memories-heading">
    <div className="memories-heading"><div><div className="eyebrow">POSTCARDS FROM TEYVAT</div><h2 id="memories-heading">旅途留影</h2></div><p>翻过攻略，也看看与旅伴走过的风景。</p></div>
    <div className="memories-grid">{['fontaine','arlecchino','nodkrai'].map(key=><TravelFigure key={key} art={travelArt[key]}/>)}</div>
  </section>;
}
