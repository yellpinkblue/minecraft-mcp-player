# Minecraft MCP Player

Control **your own Minecraft Java character** with Codex or another MCP client, in a normal single-player world. No second bot player, browser game, dedicated server, or Open to LAN is needed in native player mode.

This is a derivative of [yuniko-software/minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server), based on commit `240c8cec337ce152cc9e058ebdef511055808406`. It preserves the original 22 MCP tools and adds a Fabric client execution backend, `get-state`, and `stop-actions` (24 tools total). The original Mineflayer bot backend is still available.

**Status:** experimental, working prototype. The project owner tested Codex controlling the player in **survival mode**, including autonomous item collection, and reported that it plays relatively smoothly. A separate developer smoke test verified an actual native-player jump (about 1.25 blocks), a block query, and stopping. A simulated Fabric peer verified dispatch of all 22 original tools and cancellation over real MCP stdio. This does not establish that every recipe, terrain, creative-mode action, or complex building task works.

[中文说明](README.zh-CN.md) · [Original upstream README](README.upstream.md)

## How it works

```text
Codex / MCP client -> MCP stdio server -> authenticated localhost bridge
                                         -> Fabric mod -> your Minecraft player
```

The model receives the tool descriptions and schemas through MCP. It plans actions, calls tools, examines actual results, and chooses the next step. The server itself does not require an Alibaba or OpenAI API key. Your MCP client provides the model. Voice UI and paid voice services are not included in this repository.

## Requirements

- Minecraft **Java 1.21.11**, **Fabric Loader 0.18.4**, **Fabric API 0.141.6+1.21.11**.
- Java **21**; Node.js **22+** recommended (upstream supports >=20.10).
- **Baritone API Fabric 1.17.0**, installed as a separate mod and used as a build dependency.
- Codex or another local MCP client. Windows was used for actual gameplay testing; other operating systems are not gameplay-validated.

Survival mode is the recommended starting point. `fly-to` requires the player to have flight permission (normally creative mode); it does not grant flight or run cheats.

## Install and build

Clone this repository and open a terminal in its root:

```sh
npm ci
npm run build
node scripts/fetch-baritone.mjs
```

The fetch script downloads the separate Baritone jar from its upstream release and verifies its SHA256. Build the Fabric mod with Java 21:

```sh
cd fabric-mod
# Windows:
.\gradlew.bat build
# Linux/macOS instead:
./gradlew build
```

Copy these jars into the `mods` folder of the Minecraft instance you actually launch:

- Fabric API for the version above (obtain it separately).
- `fabric-mod/libs/baritone-api-fabric-1.17.0.jar`.
- `fabric-mod/build/libs/astra-voice-1.0.0.jar` (the runtime jar, not the `-sources.jar`).

Back at the repository root, generate the local pairing file, using **your actual game instance directory** (the folder containing `mods`, `config`, and `saves`):

```sh
node scripts/init-player-config.mjs "C:/path/to/your/minecraft-instance"
```

This generates a random local token and refuses to overwrite an existing `config/astra-voice.json`. For an existing installation, reuse its pairing file and set `backend.autoStart` to `false` to keep an old voice backend from competing with the MCP bridge. Never publish the pairing file.

## Connect Codex

Add the following to your Codex `config.toml` (normally `%USERPROFILE%/.codex/config.toml` on Windows). Replace both paths. Existing settings should be preserved.

```toml
[mcp_servers.minecraft]
command = "node"
args = ["C:/path/to/minecraft-mcp-player/dist/main.js", "--control", "player", "--player-config", "C:/path/to/your/minecraft-instance/config/astra-voice.json"]
startup_timeout_sec = 30
tool_timeout_sec = 300
```

Use the absolute path to `node.exe` if your desktop app cannot find Node on PATH. No `MINECRAFT_PLAYER_PROJECT` variable or separate voice-project installation is needed for a fresh installation of this repository.

Fully restart Codex, use a **local session on the computer running Minecraft**, launch the Fabric profile, enter a single-player world, and close all game menus. Close any other voice/MCP backend using port 8765 first; only one backend can own that bridge at a time. If the connection has not appeared, run `/astra connect` in Minecraft.

Try this first:

> Use the minecraft MCP to inspect my player state and inventory. Then jump once and report the observed result.

Then try a survival goal:

> Collect enough wood to craft a crafting table and a wooden pickaxe. Check the results after each step and tell me if you get stuck.

The MCP welcome enables control once per world session. **F9 in Minecraft stops and disarms control. F8 enables it again** after you close menus and release movement keys. Reconnecting after a stop may require F8. `stop-actions` cancels current work but does not provide the same persistent disarm as F9.

Switching focus can pause single-player Minecraft. Turn off **Pause on lost focus** (F3+P in Java Edition) if needed and leave the game out of menus. If actions are rejected, inspect `get-state` and `/astra status` before retrying.

## Tools

| Category | MCP tools |
| --- | --- |
| State and stopping | `get-state`, `stop-actions`, `get-position`, `detect-gamemode` |
| Movement and looking | `move-to-position`, `move-in-direction`, `look-at`, `jump`, `fly-to` |
| Inventory | `list-inventory`, `find-item`, `equip-item` |
| Blocks and entities | `get-block-info`, `find-blocks`, `find-entity`, `dig-block`, `place-block` |
| Crafting and smelting | `list-recipes`, `get-recipe`, `can-craft`, `craft-item`, `smelt-item` |
| Chat | `send-chat`, `read-chat` |

Tools operate through normal client mechanics and the installed Baritone API. Queries cover loaded nearby terrain, not the whole world. Navigation can fail on difficult terrain. Crafting supports the translated vanilla recipes; arbitrary modded recipes are not guaranteed. Smelting uses an available furnace/blast furnace/smoker and conservatively rejects occupied slots. Container GUI mirroring, complete chest management, automatic combat, and reliable autonomous large builds are not implemented merely by exposing these tools.

Original bot mode remains the default for compatibility. Always pass **`--control player --player-config ...`** for your own character. Without those flags the upstream Mineflayer backend is used; see the upstream README for bot/server instructions.

## Development and checks

```sh
npm run build
npm test
npm run test:native
```

`test:native` uses a simulated Fabric peer and real MCP SDK stdio transport, and makes no cloud/model calls. It is a transport and mapping check, not a gameplay benchmark. The Fabric sources also include Java unit tests run by Gradle's `build` task.

## Dependency status

The retained upstream dependency tree currently has unresolved npm audit advisories. This prototype is intended for a local trusted MCP client and loopback bridge; it has not undergone a security audit. Dependency upgrades are separate work and are not silently applied as part of this fork.

## Attribution and licensing

- Original MCP server: **yuniko-software/minecraft-mcp-server**, Apache-2.0. Original Git history and the root `LICENSE` are preserved. The native TypeScript adapter and repository helper scripts are distributed under Apache-2.0.
- Fabric controller: adapted from **tommywalteryespls-bit/minecraft-ai-player** (base commit `d77377957fbfbb55de179165165421c160b0aa9c`) and extended locally for native MCP. Its MIT license is preserved in `fabric-mod/LICENSE`.
- Mindcraft references and separately installed **Baritone** (LGPL-3.0): see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Baritone remains a separate, replaceable dependency; its binary is not committed here.

Minecraft, Fabric API, Node.js, Java runtimes, accounts, model keys, game saves, and local pairing tokens are not bundled. This project is not affiliated with Mojang or Microsoft.
