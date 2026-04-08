# SVG Metro

A Mini Metro-inspired transport simulation inside a SVG file. `minimetro.svg` is the primary playable artifact.

<img src="https://cdn.ujjwalvivek.com/showcase/svg-metro.gif" width="100%" height="600">

Play on Itch.io: [SVG Metro](https://ujjwalvivek.itch.io/svg-metro)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          INPUT & CONTROLS                              │
│       ┌─────────────────┐             ┌──────────────────────┐         │
│       │ Pointer Handler │  ────────>  │ Tactile Route Editor │         │
│       └─────────────────┘             └──────────────────────┘         │
└───────────────────────────────────────────────────┼────────────────────┘
                                                    │
┌────────────────────────────────────────────────── │ ───────────────────┐
│                        TS HEADLESS SIMULATION     ▼                    │
│  ┌────────────────────┐               ┌────────────────────┐           │
│  │ BFS Network Router │  ──────────>  │    World State     │           │
│  └────────────────────┘               └────────────────────┘           │
│                                                  ▼                     │
│  ┌────────────┐                       ┌────────────────────┐           │
│  │ Train Sim  │                       │    Tick Manager    │           │
│  └────────────┘                       └────────────────────┘           │
│  ┌────────────┐                                  │                     │
│  │    Sim     │                                  │                     │
│  │  Station   │                                  │                     │
│  └────────────┘                                  │                     │
└──────────────────────────────────────────────────┼─────────────────────┘
                                    ┌──────────────┴──────────┐
                                    │                         ▼
┌────────────────────────────────── │ ─────────────┐ ┌───────────────────┐
│                 SVG DOM MIRROR    │              │ │ PROCEDURAL AUDIO  │
│                                   ▼              │ │                   │
│  ┌────────────┐       ┌───────────────────────┐  │ │ ┌───────────────┐ │
│  │ SVG Canvas │       │     Update System     │  │ │ │   Web Audio   │ │
│  │  & layers  │       └───────────────────────┘  │ │ │     Synth     │ │
│  └────────────┘                   ▼              │ │ └───────────────┘ │
│  ┌────────────┐       ┌───────────────────────┐  │ └───────────────────┘
│  │  Dynamic   │       │   SVG Element Node    │  │
│  │   Paths    │       │         Cache         │  │
│  └────────────┘       └───────────────────────┘  │
└──────────────────────────────────────────────────┘
```

## Quick Start

### Install from npm

```sh
npm install @ujjwalvivek/svg-metro
```

The SVG is at `node_modules/@ujjwalvivek/svg-metro/dist/minimetro.svg`. Drop it into any HTML page via an `<object>` tag or open directly in a browser.

### Install from GitHub Packages

```sh
npm config set @ujjwalvivek:registry https://npm.pkg.github.com
npm install @ujjwalvivek/svg-metro
```

### From CDN

```html
<object data="https://cdn.jsdelivr.net/npm/@ujjwalvivek/svg-metro@latest/dist/minimetro.svg" type="image/svg+xml" width="100%" height="100%"></object>
```

### From URL

Open the URL directly in a browser:  

`https://cdn.jsdelivr.net/npm/@ujjwalvivek/svg-metro@latest/dist/minimetro.svg`
`https://unpkg.com/@ujjwalvivek/svg-metro@latest/dist/minimetro.svg`

### Controls

- `Click` stations to draft a line.
- `Enter` commits the drafted line.
- `R` removes the active line, or clears the current draft.
- `N` starts a new game.
- `opts` opens sound and volume controls in the lean build.
- `save` exports the current game as a playable SVG file.

## License

This project is licensed under the MIT License.
