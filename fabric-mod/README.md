# Native player Fabric controller

Client-side executor for Minecraft MCP Player. This directory retains the `astra_voice` mod ID, `/astra` commands, and MIT license from the original controller for compatibility with existing installations.

Use the [root installation instructions](../README.md#install-and-build), which describe the supported Minecraft/Fabric/Baritone versions and Codex pairing setup. Run `node scripts/fetch-baritone.mjs` from the repository root before building here with Java 21 and `gradlew.bat build` (Windows) or `./gradlew build`.

The MCP version uses an externally started authenticated localhost backend. Generate `config/astra-voice.json` with the root helper and keep `backend.autoStart` disabled. `/astra status` reports connection state; `/astra connect` reloads pairing and retries. F9 stops/disarms, and F8 toggles control. An authenticated MCP welcome enables controls once per world session. See the root README for reconnect behavior.

Legacy voice and managed-backend plumbing is retained in the source but is not part of the published MCP setup. In particular, `/astra voice` points to the old optional local voice web page; this repository does not provide that page or require a browser.

Source origin: [tommywalteryespls-bit/minecraft-ai-player](https://github.com/tommywalteryespls-bit/minecraft-ai-player), base commit `d77377957fbfbb55de179165165421c160b0aa9c`, with local changes including native MCP queries, movement evidence, flight, placement, furnace mapping and session/control handling. Mindcraft and Baritone attribution appears in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
