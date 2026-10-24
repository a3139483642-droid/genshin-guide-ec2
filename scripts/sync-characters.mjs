import {readFile, writeFile, access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Manual catalog refresh only. All website data and portraits remain bundled locally.
const root = fileURLToPath(new URL('../', import.meta.url));
const endpoint = 'https://genshin-db-api.vercel.app/api/v5/characters?query=names&matchCategories=true&verboseCategories=true';
const languages = ['ChineseSimplified', 'English'];
const [chinese, english] = await Promise.all(languages.map(async language => {
  const response = await fetch(`${endpoint}&resultLanguage=${language}`, {signal: AbortSignal.timeout(45000)});
  if (!response.ok) throw new Error(`Character source unavailable: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Unexpected character source');
  return data;
}));
const englishById = new Map(english.map(character => [character.id, character.name]));
const icons = JSON.parse(await readFile(path.join(root, 'src/data/game-icons.json'), 'utf8')).characters;
const iconsById = new Map(icons.map(icon => [icon.id, icon]));
// Keep the original URLs and five-star order stable; append four-stars by release.
const opening = ['kazuha', 'raiden', 'nahida', 'neuvillette', 'hutao', 'zhongli', 'ayaka', 'furina'];
const stableIds = {10000047:'kazuha',10000052:'raiden',10000073:'nahida',10000087:'neuvillette',10000046:'hutao',10000030:'zhongli',10000002:'ayaka',10000089:'furina',10000005:'aether',10000007:'lumine'};
const nicknames = {
  枫原万叶:'万叶 枫原',雷电将军:'雷神 影 雷电',纳西妲:'草神 小吉祥草王',那维莱特:'水龙 那维',胡桃:'堂主',钟离:'岩神 帝君',神里绫华:'绫华 神里',芙宁娜:'水神 芙芙',
  琴:'琴团长 代理团长',迪卢克:'卢姥爷 迪姥爷',莫娜:'莫师傅',刻晴:'刻师傅 阿晴',温迪:'风神 巴巴托斯',可莉:'蹦蹦炸弹',达达利亚:'公子 达达鸭 childe',魈:'降魔大圣 金鹏',
  甘雨:'椰羊',阿贝多:'白垩老师',优菈:'优拉',宵宫:'长野原宵宫',珊瑚宫心海:'心海',荒泷一斗:'一斗',申鹤:'小姨',八重神子:'神子 八重 狐狸',神里绫人:'绫人',
  提纳里:'小提',流浪者:'散兵 阿帽',艾尔海森:'海森',迪希雅:'迪西娅',白术:'白先生',莱欧斯利:'莱欧 公爵',闲云:'留云借风真君 留云',阿蕾奇诺:'仆人 父亲',
  希诺宁:'豹女',玛薇卡:'火神',茜特菈莉:'奶奶',梦见月瑞希:'瑞希 梦见月',伊涅芙:'机器女仆',菈乌玛:'鹿仙人',哥伦比娅:'少女 月神',法尔伽:'大团长',桑多涅:'木偶',
  空:'旅行者 男主 男旅行者 空哥',荧:'旅行者 女主 女旅行者 荧妹',
  班尼特:'班神 点赞哥 班爷',菲谢尔:'皇女 断罪皇女 小艾咪',北斗:'大姐头',芭芭拉:'芭芭拉冲呀',
  诺艾尔:'女仆 高达',凝光:'天权',行秋:'秋少爷',香菱:'锅巴',雷泽:'狼少年',丽莎:'丽莎姐姐',凯亚:'凯子哥',
  迪奥娜:'猫猫',罗莎莉亚:'修女',烟绯:'律法咨询师',九条裟罗:'九条 裟罗',久岐忍:'阿忍 忍姐',
  鹿野院平藏:'平藏 小鹿',珐露珊:'珐姐 珐前辈',绮良良:'猫又',莱依拉:'莱伊拉',
  嘉明:'舞兽少年',欧洛伦:'大孙子',伊安珊:'教练',叶洛亚:'执灯人',布伦妮:'魔女猎人',
};
const tagGroups = [
  [['输出'], '胡桃 神里绫华 神里绫人 迪卢克 可莉 刻晴 达达利亚 宵宫 荒泷一斗 赛诺 艾尔海森 林尼 娜维娅 克洛琳德 基尼奇 玛拉妮 恰斯卡 菲林斯 洛恩 桑多涅'],
  [['辅助'], '芙宁娜 莫娜 申鹤 夜兰 杜林 尼可 沃雅妮莎'],
  [['辅助','聚怪'], '枫原万叶 温迪'],
  [['输出','充能'], '雷电将军'],
  [['辅助','元素反应'], '纳西妲 妮露 菈乌玛 哥伦比娅 奥黛塔'],
  [['输出','重击'], '那维莱特 甘雨 提纳里 莱欧斯利 奈芙尔'],
  [['辅助','护盾'], '钟离 茜特菈莉 伊涅芙'],
  [['辅助','治疗'], '琴 七七 珊瑚宫心海 白术 希格雯 闲云 希诺宁 梦见月瑞希 爱可菲 莉奈娅'],
  [['后台输出'], '阿贝多 八重神子 千织 艾梅莉埃'],
  [['输出','下落攻击'], '魈 瓦雷莎'],
  [['输出','物理'], '优菈'],
  [['输出','飞行'], '流浪者'],
  [['输出','生命之契'], '阿蕾奇诺'],
  [['输出','元素战技'], '玛薇卡 丝柯克 兹白 法尔伽'],
  [['输出','元素反应'], '薇斯纳'],
  [['辅助','承伤'], '迪希雅'],
  [['输出','联动角色'], '埃洛伊'],
  [['旅行者','元素切换'], '空 荧'],
  [['输出'], '安柏 凝光'],
  [['输出','物理'], '雷泽 菲米尼'],
  [['输出','重击'], '烟绯 赛索斯'],
  [['输出','下落攻击'], '嘉明'],
  [['输出','聚怪'], '鹿野院平藏'],
  [['输出','元素反应'], '卡维'],
  [['输出','护盾','治疗'], '诺艾尔'],
  [['后台输出'], '香菱 北斗 菲谢尔 欧洛伦'],
  [['后台输出','元素反应'], '柯莱'],
  [['辅助','后台输出'], '行秋 凯亚 罗莎莉亚'],
  [['辅助'], '九条裟罗 五郎 珐露珊 琳妮特 卡齐娜 布伦妮'],
  [['辅助','普攻'], '云堇'],
  [['辅助','聚怪'], '砂糖'],
  [['辅助','附魔'], '重云 坎蒂丝'],
  [['辅助','元素反应'], '丽莎 爱诺 叶洛亚'],
  [['辅助','护盾'], '辛焱 托马 莱依拉 绮良良 蓝砚 塔利雅'],
  [['辅助','治疗'], '芭芭拉 班尼特 早柚 瑶瑶 夏洛蒂 夏沃蕾 伊安珊 伊法 雅珂达 阿罗夏'],
  [['辅助','护盾','治疗'], '迪奥娜'],
  [['辅助','治疗','充能'], '多莉'],
  [['辅助','治疗','元素反应'], '久岐忍'],
  [['辅助','治疗','物理'], '米卡'],
];
const tagsByName = new Map(tagGroups.flatMap(([tags, names]) => names.split(' ').map(name => [name, tags])));
const versionNumber = version => String(version).split('.').reduce((sum, part, index) => sum + Number(part) / (100 ** index), 0);
const entries = chinese
  .filter(character => [4,5].includes(character.rarity) && ![10000117,10000118].includes(character.id))
  .map(character => {
    const englishName = englishById.get(character.id);
    if (!englishName) throw new Error(`Missing English name: ${character.name}`);
    const id = stableIds[character.id] || englishName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const icon = iconsById.get(character.id);
    if (icon?.name !== character.name) throw new Error(`Refresh game icons first: ${character.name}`);
    if (!tagsByName.has(character.name)) throw new Error(`Review role tags before adding: ${character.name}`);
    const traveler = [10000005,10000007].includes(character.id);
    const title = traveler ? '异乡的旅人' : character.title;
    const aliases = [...new Set([nicknames[character.name], englishName, englishName.toLowerCase(), id, title].filter(Boolean))].join(' ');
    return {...character, icon:icon.icon, tuple:[id,character.name,aliases,traveler?'多':character.elementText,character.weaponText,title,traveler?'旅':character.elementText,tagsByName.get(character.name)]};
  });
entries.sort((a,b) => {
  const ai = opening.indexOf(a.tuple[0]), bi = opening.indexOf(b.tuple[0]);
  if (ai !== -1 || bi !== -1) return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  return b.rarity - a.rarity || versionNumber(a.version) - versionNumber(b.version) || a.id - b.id;
});
if (new Set(entries.map(entry => entry.tuple[0])).size !== entries.length) throw new Error('Duplicate character URLs');
await Promise.all(entries.map(entry => access(path.join(root, 'public', entry.icon))));
const checkedAt = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const version = entries.reduce((latest, entry) => versionNumber(entry.version)>versionNumber(latest)?entry.version:latest, '1.0');
const countsByRarity = Object.fromEntries([4,5].map(rarity => [rarity, entries.filter(entry => entry.rarity === rarity).length]));
const source = `// Bundled four- and five-star playable roster; refresh with node scripts/sync-characters.mjs.\n// Excludes the two Miliastra Wonderland mannequins; Aether and Lumine each have one entry.\nexport const characterCatalogInfo = ${JSON.stringify({checkedAt,version,count:entries.length,countsByRarity,sources:[endpoint+'&resultLanguage=ChineseSimplified','https://wiki.biligame.com/ys/角色','https://ys.mihoyo.com/main/news/detail/166249','https://wiki.hoyolab.com/m/genshin/entry/11702?lang=zh-cn']},null,2)};\n\n// id, name, aliases, element, weapon, title, glyph, tags\nexport const characters = [\n${entries.map(entry=>'  '+JSON.stringify(entry.tuple)).join(',\n')}\n];\n`;
await writeFile(path.join(root, 'server/characters.mjs'), source);
console.log(JSON.stringify({count:entries.length,version,checkedAt}));
