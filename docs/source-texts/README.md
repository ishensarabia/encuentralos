# Source texts

Plain-text copies of sources that the guide **quotes word for word**. `npm run validate`,
`npm run build` and `npm test` check every `quote` in `content/` against these files, and
fail if a quote is not found exactly (whitespace and line breaks are ignored).

| File | Source | How it was made |
|---|---|---|
| `lgmdfp.txt` | Ley General en Materia de Desaparición…, last reform DOF 16-07-2025, from https://www.diputados.gob.mx/LeyesBiblio/pdf/LGMDFP.pdf (downloaded 2026-09-29) | `pdftotext -enc UTF-8`, then removed the 81 repeated page headers ("LEY GENERAL EN MATERIA…", "CÁMARA DE DIPUTADOS…"), page numbers ("N de 81") and reform annotations ("Párrafo adicionado DOF …"). |

When the law is reformed again, download the new PDF, regenerate the file the same way, and
run `npm test`: any quote whose wording changed will fail and must be updated.
