import fitz
from pathlib import Path

files = [
    Path('attached_assets/9698-InspectReport_Routine-2024-11-13-001_1788268802210.pdf'),
    Path('attached_assets/9789-InspectReport_Routine-2024-10-10-001_1788268802211.pdf'),
    Path('attached_assets/9967-InspectReport_Routine-2024-10-07-001_1788268802211.pdf'),
]
out = Path('.agents/outputs/scdot_new_reports')
out.mkdir(parents=True, exist_ok=True)
for path in files:
    doc = fitz.open(path)
    slug = path.name.split('-InspectReport')[0]
    print(f'=== {path.name} ===')
    print('pages', doc.page_count, 'metadata', doc.metadata)
    for i, page in enumerate(doc):
        text = ' '.join(page.get_text('text').split())
        hits = [term for term in ['Asset ID','Structure Number','STRUCTURE NUMBER','County','Inspection Type','ELEMENT','Deck','Superstructure','Substructure','Culvert','Timber','Critical','Follow-up','Photo'] if term.lower() in text.lower()]
        print(f'page {i+1:02d} images={len(page.get_images(full=True))} chars={len(text)} hits={hits}')
        if i < 6 or any(term.lower() in text.lower() for term in ['element', 'culvert', 'timber', 'inspection type', 'follow-up', 'critical']):
            print(text[:1600])
    for page_no in [0, 1, min(2, doc.page_count-1), doc.page_count-1]:
        page = doc[page_no]
        pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        pix.save(out / f'{slug}_page_{page_no+1}.png')
    doc.close()
