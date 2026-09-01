import fitz
from pathlib import Path
for path in sorted(Path('attached_assets').glob('*-InspectReport_Routine-2024-*.pdf')):
    doc=fitz.open(path)
    print('\n===',path.name, 'pages',len(doc),'===')
    for pno in list(range(min(6,len(doc)))) + [i for i,p in enumerate(doc) if 'INSPECTOR SIGNATURE' in p.get_text() or 'INSPECTION PHOTOS' in p.get_text() or 'INSPECTOR PROCEDURE' in p.get_text() or 'ELEMENT NOTES' in p.get_text()][:5]:
        if pno>=len(doc): continue
        text=' '.join(doc[pno].get_text('text').split())
        print(f'-- page {pno+1} --')
        print(text[:4000])
