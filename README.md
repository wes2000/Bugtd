# Bug Siege - Tower Defense

A 3D tower defense game built with Three.js. Defend your base with monster towers while sending bug troops to overwhelm your opponent!

## How to Play

1. **Build Phase**: Place monster towers on your grid (left side) to defend against enemy bugs
2. **Combat Phase**: Play bug cards to send troops through the enemy's defenses
3. **Win Condition**: Reduce the enemy base to 0 HP before they do the same to you

## Towers

| Tower | Role | Cost |
|-------|------|------|
| 🟢 Chomper | Single-target DPS | 15g |
| 🔴 Splorch | Splash/AOE damage | 20g |
| 🔵 Freezlick | Slows enemies | 15g |
| 🟡 Goldbug | Generates gold | 20g |
| 🟣 Hexling | Damage + debuffs | 20g |

Each tower has two upgrade paths at Level 2!

## Troops

| Troop | Type | Per Card |
|-------|------|----------|
| 🐜 Ant | Swarm | x5 |
| 🪲 Beetle | Tank | x1 |
| 🦗 Cricket | Fast | x3 |
| 🦋 Butterfly | Flying | x2 |
| 🐛 Caterpillar | Regen | x1 |
| 🕷️ Spider | Shield | x1 |

## Running Locally

Just serve the files with any static file server:

```bash
# Python
python -m http.server 8000

# Node.js
npx serve .
```

Then open `http://localhost:8000` in your browser.

## Tech Stack

- Three.js (3D rendering)
- Vanilla JavaScript (ES Modules)
- Web Audio API (procedural sound effects)
- No build step required

## Deploy

Works out of the box on GitHub Pages, Vercel, or Netlify - just point to the repo root.
