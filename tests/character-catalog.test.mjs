import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

for(const key of ['NETLIFY','AWS_LAMBDA_FUNCTION_NAME','DATABASE_URL','NETLIFY_DB_URL','NETLIFY_DB_DRIVER','TEYVAT_PROJECT_ROOT'])delete process.env[key];
process.env.DATA_DIR=await mkdtemp(path.join(os.tmpdir(),'teyvat-catalog-'));
const {app}=await import('../server/app.mjs');
const {database,one,rows}=await import('../server/db.mjs');
const {seed,characters,sampleGuide}=await import('../server/seed.mjs');
const {characterCatalogInfo}=await import('../server/characters.mjs');
const {seoCharacter}=await import('../server/seo.mjs');
const anonymous=request(app);
after(async()=>{await (await database()).close();});

test('complete four- and five-star catalog and safe upgrades',async t=>{
  await t.test('every playable character has a complete entry and a bundled portrait',async()=>{
    const icons=JSON.parse(await readFile(new URL('../src/data/game-icons.json',import.meta.url),'utf8')).characters;
    const playable=icons.filter(icon=>[4,5].includes(icon.rarity)&&![10000117,10000118].includes(icon.id));
    assert.equal(characters.length,122);
    assert.equal(playable.filter(icon=>icon.rarity===4).length,51);
    assert.equal(characterCatalogInfo.count,characters.length);
    assert.deepEqual(characterCatalogInfo.countsByRarity,{4:51,5:71});
    assert.deepEqual(characters.slice(0,8).map(c=>c[0]),['kazuha','raiden','nahida','neuvillette','hutao','zhongli','ayaka','furina']);
    assert.ok(characters.slice(0,71).every(c=>playable.find(icon=>icon.name===c[1]).rarity===5));
    assert.deepEqual(new Set(characters.map(c=>c[1])),new Set(playable.map(c=>c.name)));
    assert.equal(new Set(characters.map(c=>c[0])).size,characters.length);
    for(const [id,name,aliases,element,weapon,title,glyph,tags] of characters){
      assert.match(id,/^[a-z0-9-]{2,60}$/);
      assert.ok(aliases.length>0&&aliases.length<=200,name);
      assert.ok(['风','岩','雷','草','水','火','冰','多'].includes(element),name);
      assert.ok(['单手剑','双手剑','长柄武器','弓','法器'].includes(weapon),name);
      assert.ok(title&&glyph.length<=2&&tags.length,name);
      const icon=playable.find(icon=>icon.name===name);
      const bytes=await readFile(new URL('../public'+icon.icon,import.meta.url));
      assert.deepEqual(bytes.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]),name);
    }
  });

  await t.test('a direct character visit initializes the complete catalog',async()=>{
    const detail=await anonymous.get('/api/characters/vesna');
    assert.equal(detail.status,200);
    assert.equal(detail.body.character.name,'薇斯纳');
    assert.deepEqual(detail.body.plans,[]);
    assert.equal(Number((await one('SELECT count(*) FROM characters')).count),122);
  });

  await t.test('six pages return every character once in the existing opening order',async()=>{
    const pages=await Promise.all([1,2,3,4,5,6].map(page=>anonymous.get('/api/characters?page='+page)));
    pages.forEach(page=>{assert.equal(page.status,200);assert.equal(page.body.total,122);});
    assert.deepEqual(pages.map(page=>page.body.items.length),[24,24,24,24,24,2]);
    const ids=pages.flatMap(page=>page.body.items.map(c=>c.id));
    assert.equal(new Set(ids).size,122);
    assert.deepEqual(ids,characters.map(c=>c[0]));
  });

  await t.test('all 51 four-stars have public detail pages and searchable names',async()=>{
    for(const [id,name] of characters.slice(71)){
      const detail=await anonymous.get('/api/characters/'+id);
      assert.equal(detail.status,200,name);
      assert.equal(detail.body.character.name,name);
      assert.deepEqual(detail.body.plans,[]);
      const search=await anonymous.get('/api/characters').query({q:name});
      assert.equal(search.status,200,name);
      assert.ok(search.body.items.some(c=>c.id===id),name);
    }
  });

  await t.test('new names, nicknames, English names, weapons and elements are searchable',async()=>{
    for(const [query,expected] of [['木偶','sandrone'],['心海','sangonomiya-kokomi'],['Vodyanitsa','vodyanitsa'],['点赞哥','bennett'],['皇女','fischl'],['阿忍','kuki-shinobu'],['Prune','prune'],['Alyosha','alyosha'],['九条','kujou-sara']]){
      const result=await anonymous.get('/api/characters').query({q:query});
      assert.equal(result.status,200);
      assert.equal(result.body.total,1,query);
      assert.equal(result.body.items[0].id,expected,query);
    }
    const travelers=await anonymous.get('/api/characters').query({q:'旅行者'});
    assert.equal(travelers.body.total,2);
    assert.deepEqual(new Set(travelers.body.items.map(c=>c.id)),new Set(['aether','lumine']));
    for(const element of ['风','岩','雷','草','水','火','冰']){
      const result=await anonymous.get('/api/characters').query({element});
      assert.equal(result.status,200);
      assert.ok(result.body.items.every(c=>c.element===element||c.element==='多'));
      assert.ok(['aether','lumine'].every(id=>result.body.items.some(c=>c.id===id)));
    }
    const weapons=await anonymous.get('/api/characters').query({q:'长柄武器'});
    assert.ok(weapons.body.total>0);
    assert.ok(weapons.body.items.every(c=>c.weapon==='长柄武器'));
    assert.equal((await anonymous.get('/api/characters?ready=true')).body.total,0);
    const seo=await seoCharacter('vodyanitsa',null,'<div id="root"></div>');
    assert.equal(seo.status,200);
    assert.match(seo.html,/沃雅妮莎/);
    assert.match((await seoCharacter('aether',null,'<div id="root"></div>')).html,/元素可切换/);
    assert.match((await seoCharacter('bennett',null,'<div id="root"></div>')).html,/班尼特/);
    assert.match((await seoCharacter('alyosha',null,'<div id="root"></div>')).html,/阿罗夏/);
  });

  await t.test('an existing 71-character catalog gains all four-stars without changing its entries',async()=>{
    const existingIds=characters.slice(0,71).map(c=>c[0]);
    await rows('DELETE FROM characters WHERE NOT(id=ANY($1::text[]))',[existingIds]);
    await rows("UPDATE characters SET aliases='保留自定义资料',sort_order=800,visible=FALSE WHERE id='jean'");
    const before=await rows('SELECT * FROM characters ORDER BY id');
    await Promise.all([seed(),seed(),seed()]);
    await seed();
    assert.equal(Number((await one('SELECT count(*) FROM characters')).count),122);
    assert.deepEqual(await rows('SELECT * FROM characters WHERE id=ANY($1::text[]) ORDER BY id',[existingIds]),before);
    for(const [id,name] of characters.slice(71))assert.equal((await one('SELECT name FROM characters WHERE id=$1',[id])).name,name);
  });

  await t.test('an eight-character database is supplemented without changing existing content',async()=>{
    const opening=characters.slice(0,8).map(c=>c[0]);
    await rows("UPDATE characters SET id='custom-diluc' WHERE id='diluc'");
    await rows('DELETE FROM characters WHERE NOT(id=ANY($1::text[]))',[[...opening,'custom-diluc']]);
    const guide=JSON.stringify(sampleGuide());
    await rows("INSERT INTO users(id,username,display_name,password_hash,role) VALUES('owner','owner','站长','unused','owner')");
    await rows("INSERT INTO plans(id,character_id,owner_id,title,draft,status,public_version) VALUES('keep-plan','kazuha','owner','保留的攻略',$1,'published','keep-version')",[guide]);
    await rows("INSERT INTO versions(id,plan_id,number,data) VALUES('keep-version','keep-plan',1,$1)",[guide]);
    await rows("UPDATE characters SET aliases='站长自定义别名',visible=FALSE,sort_order=321,recommended_plan='keep-plan' WHERE id='kazuha'");
    const before=await one("SELECT * FROM characters WHERE id='kazuha'");
    const plan=await one("SELECT * FROM plans WHERE id='keep-plan'");
    await Promise.all([seed(),seed(),seed()]);
    await seed();
    assert.equal(Number((await one('SELECT count(*) FROM characters')).count),122);
    assert.equal((await one("SELECT count(*) FROM characters WHERE name='迪卢克'")).count,1);
    assert.ok(await one("SELECT id FROM characters WHERE id='custom-diluc'"));
    assert.deepEqual(await one("SELECT * FROM characters WHERE id='kazuha'"),before);
    assert.deepEqual(await one("SELECT * FROM plans WHERE id='keep-plan'"),plan);
    assert.equal((await anonymous.get('/api/characters')).body.total,121);
    assert.equal((await anonymous.get('/api/characters/kazuha')).status,404);
    assert.equal((await anonymous.get('/api/characters/vodyanitsa')).status,200);
  });
});
