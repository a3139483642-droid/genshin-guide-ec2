"""Archive the explicitly supplied attachments and inventory them without recompression."""
from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
batch = root / '.data/guide-imports/20261023'
originals = batch / 'originals'
originals.mkdir(parents=True, exist_ok=True)
attachments = []
unique = {}
for index, line in enumerate((batch / 'attachments.txt').read_text(encoding='utf-8').splitlines()):
    if not line.strip():
        continue
    uuid, name = line.split()
    source = Path('C:/Users/JIATIA~1/AppData/Local/Temp') / f'codex-clipboard-{uuid}.jpg'
    buffer = source.read_bytes()
    digest = hashlib.sha256(buffer).hexdigest()
    with Image.open(source) as im:
        im.verify()
    with Image.open(source) as im:
        width, height = im.size
    item = {'attachment': len(attachments)+1, 'originalFilename': source.name, 'characterName': name, 'sha256': digest, 'width': width, 'height': height, 'size': len(buffer)}
    attachments.append(item)
    if digest in unique:
        assert unique[digest]['characterName'] == name, 'Duplicate assigned to different characters'
        unique[digest]['attachments'].append(item['attachment'])
        continue
    filename = f'{name}-{digest[:12]}.jpg'
    destination = originals / filename
    if destination.exists():
        assert hashlib.sha256(destination.read_bytes()).hexdigest() == digest
    else:
        shutil.copyfile(source, destination)
    unique[digest] = {**item, 'file': f'originals/{filename}', 'attachments': [item['attachment']]}

manifest = {'format': 'teyvat-guide-image-batch-v1', 'batchId': 'user-images-20261023', 'imageAuthor': '阿斯盖特（Asgater）', 'authorComment': '', 'gameVersion': '来源未注明', 'source': '用户提供；原图署名：米游社@Asgater（阿斯盖特）', 'attachments': attachments, 'images': list(unique.values())}
(batch / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

# A compact inspection sheet retains the name area plus the character illustration.
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 18)
images = list(unique.values())
for offset in range(0, len(images), 30):
    page = images[offset:offset+30]
    sheet = Image.new('RGB', (1500, ((len(page)+5)//6)*220), 'white')
    draw = ImageDraw.Draw(sheet)
    for pos, item in enumerate(page):
        im = Image.open(batch / item['file'])
        # All supplied guides place their character title in the top 28 percent.
        im = im.crop((0, 0, im.width, min(im.height, int(im.height*.28))))
        im.thumbnail((240, 187))
        x, y = (pos%6)*250, (pos//6)*220
        sheet.paste(im, (x, y))
        draw.text((x+4, y+192), f"{offset+pos+1:03} {item['characterName']}", fill='black', font=font)
    sheet.save(batch / f'角色核对-{offset//30+1}.jpg', quality=90)
print(json.dumps({'attachments': len(attachments), 'uniqueImages': len(unique), 'duplicateAttachments': len(attachments)-len(unique), 'uniqueMB': round(sum(x['size'] for x in images)/1048576, 2), 'maxBytes': max(x['size'] for x in images)}, ensure_ascii=False))
