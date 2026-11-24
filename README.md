# News Image — Tuesday 24 November 2026

Entry for the make.fun bounty [news-image-20261124](https://make.fun/bounty/news-image-20261124): sum up one day of world news in a single image.

![rank](https://make.fun/badge/news-image-20261124.svg)
![rank](https://make.fun/badge/news-image-20261124/ydhikaaa/news-image-20261124/rank.svg)
![reward](https://make.fun/badge/news-image-20261124/ydhikaaa/news-image-20261124/reward.svg)

## What it does

`main.ts` is a small, dependency-free Node program that paints a complete
broadsheet front page for Tuesday 24 November 2026 onto a 1024x1024 pixel
canvas and encodes the result as a PNG. The page carries:

- a masthead with the date and a five-cell stats strip,
- 33 stories across 7 regions: 3 illustrated lead panels, 10 smaller
  illustrated panels, and 20 further headlines in an "Also on the front
  page" index,
- a "Where it happened" map strip with a numbered pin for each of the
  13 illustrated stories,
- a date-check footer that names the stories deliberately excluded
  because they belong to earlier days.

Every panel scene is drawn with rect / circle / ellipse / line / triangle /
polygon primitives and clipped to its own panel box, and all lettering uses
a hand-rolled 5x7 bitmap font. The PNG encoder is hand-written too (CRC32
plus zlib `deflateSync` for the IDAT chunk). The output is deterministic:
repeated runs produce byte-identical files.

## How to run

```sh
node main.ts
```

This writes `entry.png` into `$MAKEFUN_OUTPUT_DIR` (default `/output`).
Requires Node 22 or newer; no packages to install.
