"""Freeze regular/italic web reader cuts. Use the pinned uv command from home generator."""
import hashlib, json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
root=Path(__file__).resolve().parent.parent
paths=[*root.glob('apps/web/.next/static/media/*.woff2'),*root.glob('apps/web/.next/dev/static/media/*.woff2')]
records=[]
for italic,weight,sizes in [(False,400,(17,23)),(True,400,(17,23,21,28)),(True,600,(17,20,21,23,26,27,28,35))]:
    candidates=[]
    for path in paths:
        f=TTFont(path)
        if f['name'].getDebugName(1)=='Source Serif 4' and bool(f['head'].macStyle & 2)==italic and all(c in f.getBestCmap() for c in (65,97,8212,8217)):
            candidates.append(path)
    if not candidates: raise SystemExit('Start web first: missing Latin serif subset')
    source=min(candidates,key=lambda p:p.stat().st_size)
    for size in sizes:
        f=instantiateVariableFont(TTFont(source),{'wght':weight,'opsz':size},inplace=True)
        family=f"Cosmic{'BoldItalic' if italic and weight==600 else 'Italic' if italic else 'Prose'}{size}"
        for n in f['name'].names:
            if n.nameID in (1,3,4,6,16): n.string=family.encode(n.getEncoding())
            elif n.nameID in (2,17): n.string='Regular'.encode(n.getEncoding())
        f.flavor=None;f.recalcTimestamp=False
        f['OS/2'].usWeightClass=400
        # Each font is its own family; its italic outlines are already frozen.
        f['head'].macStyle=0; f['OS/2'].fsSelection &= ~((1<<0)|(1<<5)); f['OS/2'].fsSelection |= 1<<6
        target=root/'apps/mobile/assets/fonts'/f'{family}.ttf';f.save(target)
        records.append({'file':target.name,'weightAxis':weight,'opticalSize':size,'italic':italic,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()})
(root/'apps/mobile/assets/fonts/web-detail-fonts.json').write_text(json.dumps({'source':'Source Serif 4, web Latin subsets, SIL OFL (LICENSES.txt)','toolchain':{'fonttools':'4.60.1','brotli':'1.1.0'},'instances':records},indent=2)+'\n')
print(f'Generated {len(records)} detail reader instances')
