# Wild World: design

Inspired by a dark, monochrome gallery layout: a light-grey side panel with a sideways title, a
black stage with a glassy sphere, and big numbers underlined in amber.

## Colours (`web/assets/css/app.css`, `:root`)

| Token | Hex | Use |
|-------|-----|-----|
| `--night` | `#0A0A0A` | page and stage background |
| `--night-2` / `--night-3` | `#141414` / `#1E1E1E` | cards, chips, empty photo slots |
| `--line` | `#2A2A2A` | borders, dividers |
| `--bone` | `#F5F5F3` | text on dark |
| `--panel` | `#E4E4E2` | light side panel and the animal card |
| `--ash` | `#A3A3A0` | secondary text on dark |
| `--ink` / `--ink-soft` | `#0A0A0A` / `#4A4A48` | text on the light panel |
| `--amber` | `#E8A33D` | the one accent: underlines, dots, selection, focus ring |
| `--red` | `#B3261E` | Endangered / Critically Endangered badge only |

Amber is never used as text on the light panel (too little contrast).

## Lettering

- Headings: Outfit 500–700, tight and geometric.
- Body: Work Sans 400–600, 16px base, line-height 1.6.
- Loaded from Google Fonts with `display=swap`.

## Layout

- Stage: `26%` light panel (sideways "Wild World" title, hint, "Collections · N sightings")
  and the globe filling the rest, full viewport height. Stacks to one column under 900px.
- Stats over the globe on the left: number, amber underline, label; the middle one in a
  translucent box.
- Sections below (`Places`, `Sightings`) are numbered `01`, `02` in amber with a rule under
  the heading. Max width 1240px.
- Radius is square (0–4px) everywhere except the round wheel and markers.

## Components

- **Globe** (`assets/js/scenes/globe.js`): near-black sphere, fresnel glass rim and halo,
  dotted land and faint borders from world-atlas, 30° graticule. One amber dot and spike per
  country; spike height grows with sightings. Dots are HTML buttons over the canvas.
  Drag to turn, no scroll-zoom; auto-rotates until touched.
- **Wheel** (`assets/js/wheel.js`): full-screen dim overlay, GTA-style ring of slices, one per
  animal in that country. Pointer angle, hover or arrow keys select; selected slice fills
  amber, its photo goes from greyscale to colour. Centre shows country, animal and count.
- **Animal card**: light panel sliding in from the right with photo, IUCN status badge, name,
  scientific and Kiswahili names, a fact with an amber rule, size, family, counts, dates,
  observers and recent sightings linking to their card below.
- **Sighting cards**: dark tile, 4:3 photo at 70% greyscale, colour on hover; amber border on
  hover or when targeted from the animal card.

## Data

- Home shows every sighting (no filter). Places group by country (`pages/globe.go`).
- Facts are hand-written per species in `pages/facts.go`, keyed by canonical name.

## Motion

- Ease-out curves, 150–300ms; markers pulse; the camera flies to a chosen country.
- `prefers-reduced-motion`: no auto-rotate, no pulse, instant camera moves.

## Avoid

- Extra accent colours, emoji icons, rounded "bubbly" cards.
