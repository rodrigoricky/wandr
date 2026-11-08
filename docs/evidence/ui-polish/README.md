# UI polish evidence

The `before/` screenshots are the audited baseline captured from the app before UI polish changes. The `after/` screenshots were captured by the Playwright matrix using deterministic UI fixtures after the changes. `after/` contains Search, Local Results, Air Results, Local Details, and Air Details at each of ten viewports: 320×568, 320×700, 360×640, 375×667, 390×844, 430×932, 600×820, 768×1024, 1280×800, and 844×390.

The fixtures validate layout and UI behavior; their prices, route geometry, and places are synthetic and are not integration evidence. Real Geoapify evidence is recorded separately in [`../../UI_POLISH_REPORT.md`](../../UI_POLISH_REPORT.md) and [`../../TEST_REPORT.md`](../../TEST_REPORT.md).
