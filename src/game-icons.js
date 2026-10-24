import catalog from './data/game-icons.json';

// Match names in existing plain-text guides, including common community names.
const aliases = {
  characters: {
    枫原万叶: ['万叶', 'kazuha'], 雷电将军: ['雷神', '雷电', 'raiden'],
    纳西妲: ['草神', '小吉祥草王', 'nahida'], 那维莱特: ['水龙', '那维', 'neuvillette'],
    胡桃: ['hutao'], 钟离: ['岩神', '帝君', 'zhongli'],
    神里绫华: ['绫华', 'ayaka'], 芙宁娜: ['芙芙', '水神', 'furina'],
    班尼特: ['班神', '点赞哥', 'bennett'], 九条裟罗: ['九条', '裟罗', 'sara'],
    珊瑚宫心海: ['心海', 'kokomi'], 神里绫人: ['绫人', 'ayato'],
    八重神子: ['神子', '八重', 'yaemiko'], 达达利亚: ['公子', 'childe'],
    流浪者: ['散兵', 'wanderer'], 阿蕾奇诺: ['仆人', 'arlecchino'],
    温迪: ['风神', 'venti'], 玛薇卡: ['火神', 'mavuika'],
    砂糖: ['sucrose'], 行秋: ['xingqiu'], 香菱: ['xiangling'],
    夜兰: ['yelan'], 菲谢尔: ['皇女', 'fischl'], 久岐忍: ['阿忍', 'kuki'],
    莱欧斯利: ['莱欧', 'wriothesley'], 艾尔海森: ['海森', 'alhaitham'],
    希诺宁: ['xilonen'], 茜特菈莉: ['奶奶', 'citlali'],
  },
  weapons: {
    '「渔获」': ['渔获'], 薙草之稻光: ['薙草'], 苍古自由之誓: ['苍古'],
    雾切之回光: ['雾切'], 护摩之杖: ['护摩'], 和璞鸢: ['和璞'],
    万世流涌大典: ['万世流涌'], 静水流涌之辉: ['静水流涌'],
    千夜浮梦: ['千夜'], 赤沙之杖: ['赤沙'],
  },
  artifacts: {
    翠绿之影: ['风套', '翠绿套'], 绝缘之旗印: ['绝缘套', '绝缘'],
    深林的记忆: ['深林套', '草套'], 饰金之梦: ['饰金套', '饰金'],
    逐影猎人: ['逐影套', '猎人套', '逐影'], 黄金剧团: ['剧团套', '黄金剧团套'],
    昔日宗室之仪: ['宗室套', '宗室'], 千岩牢固: ['千岩套'],
    沉沦之心: ['沉沦套'], 冰风迷途的勇士: ['冰套', '冰风套'],
    炽烈的炎之魔女: ['魔女套', '火魔女'], 来歆余响: ['余响套'],
    辰砂往生录: ['辰砂套'], 乐园遗落之花: ['乐园套'],
    花海甘露之光: ['花海套'], 回声之林夜话: ['夜话套'],
    黑曜秘典: ['黑曜套'], 烬城勇者绘卷: ['烬城套', '勇者套'],
    流浪大地的乐团: ['乐团套'], 角斗士的终幕礼: ['角斗士套'],
    被怜爱的少女: ['少女套'], 海染砗磲: ['海染套'],
    沙上楼阁史话: ['楼阁套'], 水仙之梦: ['水仙套'],
    谐律异想断章: ['谐律套'], 未竟的遐思: ['遐思套'],
  },
};

const normalize = value => String(value || '').toLowerCase().replace(/[\s·.…「」『』“”"'()（）【】\[\]<>《》]/g, '');
const indexes = Object.fromEntries(Object.entries(catalog).map(([kind, entries]) => [kind,
  entries.map(entry => ({
    entry,
    names: [entry.name, ...(aliases[kind]?.[entry.name] || [])].map(normalize),
  })),
]));

export function resolveGameIcons(kind, text) {
  const query = normalize(text);
  if (!query) return [];
  const singleNames = String(text).split(/[\/／+＋、,，&＆]|或/).map(part => normalize(part.split(/[（(]/)[0]));
  const candidates = (indexes[kind] || []).flatMap(({entry, names}) => {
    const matches = names.filter(name => query.includes(name) && (name.length > 1 || singleNames.includes(name))).sort((a, b) => b.length - a.length);
    if (!matches.length) return [];
    const name = matches[0];
    return [{entry, start: query.indexOf(name), end: query.indexOf(name) + name.length}];
  }).sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const accepted = [];
  for (const candidate of candidates) {
    if (accepted.some(item => candidate.start < item.end && candidate.end > item.start)) continue;
    accepted.push(candidate);
  }
  return accepted.sort((a, b) => a.start - b.start).map(item => item.entry);
}

export function resolveGameIcon(kind, text) {
  return resolveGameIcons(kind, text)[0] || null;
}
