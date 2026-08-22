# Photography credits

All photographs on this page are used under the [Unsplash License](https://unsplash.com/license),
which permits free commercial use with no attribution required. Credits are recorded here anyway.

| File | Photographer | Source |
|---|---|---|
| `hero.jpg`, `hero-wide.jpg` | Ruffa Jane Reyes | https://unsplash.com/photos/person-walking-in-the-middle-on-vehicles-dlGhQPIstkQ |
| `spec.jpg` | Mark Chan | https://unsplash.com/photos/un-primer-plano-de-la-llave-de-un-coche-rBeQkehKIn4 |
| `lot.jpg` | Iain (photoken123) | https://unsplash.com/photos/aerial-view-of-a-parking-lot-with-many-cars-pmZnZwwn9dM |
| `road.jpg` | Claudio Schwarz | https://unsplash.com/photos/empty-road-during-golden-hour-GxSTPd0dF3I |
| `closing.jpg` | Egor Myznik | https://unsplash.com/photos/cars-driving-on-a-wet-city-street-at-night-JvaBFLM7FEY |

The hero master is landscape, so both frames are cut from it: `hero-wide.jpg` is a 2000x1200 crop
used above 720px via `<picture>`, and `hero.jpg` is a 1400x2100 portrait crop served to phones.
The portrait frame is smaller than the other masters because the source cannot give 2000px of
width at 2:3 without upscaling; 1400px still covers a 3x phone. Both crops pull in from the edges
of the master, which drops the nearest cars — see the selection constraint below. `spec.jpg` is a
centered 2000x1500 crop of its portrait master.

## Selection constraint

Frames showing a manufacturer's logo were deliberately rejected. The Unsplash License covers
copyright, not trademark — a maker's mark on a commercial page for a brand-agnostic buying service
invites a false endorsement reading. Candidates rejected on this basis included a VW steering-wheel
hub, a Mitsubishi wheel, BMW-branded keys, a Mazda 3 wheel hub, and identifiable Tesla and Kia
vehicles. Apply the same test to any replacement.

This is what shaped the hero. The obvious frame for the brief — a row of cars for sale shot down
its length — puts a grille badge or a dealership pylon sign in every candidate: a sunlit BMW row
under its own roundel, a Mini row, a Mazda row, a Ford lineup, a Cupra fleet. The frame in use
avoids that by keeping its cars at middle distance, where a badge is a few pixels. Its master does
have two readable badges on the nearest cars at the left and right edges, which is why both crops
pull in from the edges rather than using the full width. Check the corners of any re-crop.
