from pathlib import Path
import fitz

FILES = [
    Path("attached_assets/0_237-InspectReport_Routine-2025-09-03-001_1788268382390.pdf"),
    Path("attached_assets/0_AppT_1788268407178.pdf"),
    Path("attached_assets/1_SCDOT_BIGD_2026-07-20_1788268407182.pdf"),
]

out = Path(".agents/outputs/scdot-pdf-inspection")
out.mkdir(parents=True, exist_ok=True)

for path in FILES:
    doc = fitz.open(path)
    slug = path.stem[:45]
    print(f"\n=== {path.name} ===")
    print(f"pages={doc.page_count} metadata={doc.metadata}")
    for index, page in enumerate(doc):
        text = page.get_text("text").strip()
        image_count = len(page.get_images(full=True))
        print(f"page={index + 1} chars={len(text)} embedded_images={image_count}")
        if index < 3:
            print(text[:3500].replace("\x00", " "))
        if index in (0, doc.page_count - 1):
            pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
            image_path = out / f"{slug}-page-{index + 1}.png"
            pix.save(image_path)
            print(f"rendered={image_path}")