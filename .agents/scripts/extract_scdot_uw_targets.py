import fitz
from pathlib import Path
out = Path('.agents/outputs/scdot_uw_reports')
for path in sorted(Path('attached_assets').glob('*-InspectReport_UW-*.pdf')):
    doc=fitz.open(path)
    print(f'\n=== {path.name} ({len(doc)} pages) ===')
    for i,p in enumerate(doc):
        text=' '.join(p.get_text('text').split())
        if i < 5 or any(k in text.lower() for k in ['underwater inspection', 'dive information', 'underwater notes', 'inspection photos', 'inspector signature']):
            print(f'-- page {i+1} --\n{text[:6500]}')
        if any(k in text.lower() for k in ['dive information', 'underwater inspection', 'inspector signature', 'inspection photos']):
            pix=p.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False)
            pix.save(out / f'{path.name.split("-InspectReport")[0]}_target_{i+1}.png')
    doc.close()
