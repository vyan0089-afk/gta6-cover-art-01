# Neon Coast Cover Studio

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/vyan0089-afk/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/vyan0089-afk/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns your photos and a caption into GTA-style
multi-panel cover art: pick a layout, pick a Vice City sunset or neon
colour grade, write the title in bold sunset-gradient lettering with a
neon script subtitle, then export all three post sizes (1080x1080,
1080x1350, 1920x1080) as PNG with one click.

## What it does

- **6 layouts**: 3x3 grid with title block, hero-and-three, full-bleed,
  tilted snapshots, 2x2 grid, and duo split.
- **6 gradient-map grades**: Sunset, Neon Pink, Golden Hour, Dusk Purple,
  Noir, and Vice Teal.
- **Lettering**: Anton display type with a sunset-gradient fill, Pacifico
  neon script subtitle, halftone title block, badge ribbon, and a
  five-star wanted heat meter. Grain and vignette finish the poster look.
- **Any photo**: upload your own photos or drag and drop them in, use the
  two bundled sample photos, crop and position each panel (drag to pan,
  scroll or slider to zoom), fill several panels with one photo or a
  different photo per panel, and edit the caption (text, size, colour).
- **Fast and easy**: one click exports all three sizes at once.
- **Polish**: live preview, undo / redo, responsive editor, fully offline
  (vanilla JS + canvas 2D, no libraries, no network). Fonts are vendored
  under `app/fonts/` under the SIL Open Font License.

## Try it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Or open
`app/index.html` directly from the files.

## Build the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and
writes `dossier.json` with the kit's `buildDossier`.

## License

MIT — see `LICENSE`. Fonts: Anton and Pacifico, SIL Open Font License
1.1 — see `app/fonts/OFL.txt`.
