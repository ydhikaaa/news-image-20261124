# Tuesday 24 November 2026 — the world in one image

A hand-written Node 22 program (standard library only) that draws a one-page
broadsheet summing up the world news of Tuesday 24 November 2026 and writes it
to `/output/entry.png`: 33 stories across 7 regions, 13 illustrated panels, a
stats strip, a "where it happened" map and a date-check footer that names the
big stories deliberately left out because they belong to earlier days.

Entry for the make.fun bounty
[news-image-20261124](https://make.fun/bounty/news-image-20261124).

![rank](https://make.fun/badge/news-image-20261124.svg)
![rank](https://make.fun/badge/news-image-20261124/ydhikaaa/news-image-20261124/rank.svg)
![reward](https://make.fun/badge/news-image-20261124/ydhikaaa/news-image-20261124/reward.svg)

Run it:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

It runs deterministically: two runs write byte-identical PNG files.
