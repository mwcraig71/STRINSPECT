import fitz
from pathlib import Path

files = sorted(Path('attached_assets').glob('*-InspectReport_UW-*.pdf'))
out = Path('.agents/outputs/scdot_uw_reports')
for path in files:
    doc = fitz.open(path)
    print(f'=== {path.name} ===')
    print('pages', doc.page_count, 'metadata', doc.metadata)
    for i, page in enumerate(doc):
        text = ' '.join(page.get_text('text').split())
        hits = [term for term in ['SCDOT','Asset ID','Structure Number','Inspection Type','UNDERWATER','Underwater','DIVE','Diver','Visibility','Water Temperature','Scour','Piles','ELEMENT','INSPECTION PHOTOS','QC/QA','Recommendations','Sketch'] if term.lower() in text.lower()]
        print(f'page {i+1:02d} images={len(page.get_images(full=True))} chars={len(text)} hits={hits}')
        if i < 7 or any(term.lower() in text.lower() for term in ['underwater','dive','diver','visibility','water temperature','inspection photos','qc/qa','recommendations']):
            print(text[:2800])
    for page_no in [0, 1, min(2, doc.page_count-1), doc.page_count-1]:
        page = doc[page_no]
        pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        pix.save(out / f'{path.name.split("-InspectReport")[0]}_page_{page_no+1}.png')
    doc.close()
