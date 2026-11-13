# HARBOR SIEGE: TERMINAL ZERO

A modular browser FPS starter project with a low-end-friendly Three.js scene, first-person controls, basic enemy combat, pickups, survival waves, offline FFA entry point, and six-player private Socket.IO rooms.

## Requirements
- Node.js 20 or newer
- npm 10+

## Run locally
```bash
npm install
npm run dev
```
Vite usually serves the client at http://localhost:5173 and the multiplayer server at http://localhost:3001.

## Test multiplayer locally
1. Open the client in two or more browser windows.
2. In each window choose Online Multiplayer.
3. One player creates a room and shares the six-character code.
4. Other players join with that code.
5. All players press Ready; the host starts the match.
6. For internet play, deploy the server and client as described below.

## Deploy free initially
### Server (Render or Railway)
- Create a new Node web service from this repository.
- Root directory: `server` (or deploy from repository root using workspace commands).
- Build command from repository root: `npm install`
- Start command from repository root: `npm run start -w server`
- Set `CLIENT_ORIGIN` to the deployed client URL, or `*` for initial testing.
- The free instance may sleep when idle; first connection may take time. Free tiers and limits can change.

### Client (Render static site, Netlify or Vercel)
- Root directory: `client`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_SERVER_URL=https://YOUR-SERVER-HOST`
- Redeploy after setting the variable.

For local development, the client connects to the same origin by default; Vite proxy is configured below.

## Controls
- WASD move, Shift sprint, Space jump
- Mouse look; left click fire; right click aim
- R reload; 1/2/3 select weapon; Q quick-switch
- Escape pause

## Current build scope and honest limitations
This is a functional development foundation, not a finished AAA production game. The environment is procedurally assembled from low-poly geometry. Enemy AI and combat are deliberately lightweight. The online backend currently provides real private room creation/joining, a server-enforced six-player cap, readiness, host start authorization, player transform replication and basic combat event relay.

Before public release, add server-authoritative hit validation, synchronized enemy/wave simulation, robust reconnect/session recovery, anti-cheat protections, proper character/weapon GLB assets, full animation sets, audio, accessibility, mobile virtual camera controls, automated tests, and production monitoring. The current multiplayer prototype synchronizes player presence and movement; it does not yet synchronize the complete PvE campaign or authoritative damage/kill state.
