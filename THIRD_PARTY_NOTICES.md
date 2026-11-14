# Mindcraft reference and attribution

The item-acquisition workflow and gameplay-skill organization in this project
were adapted from studying [Mindcraft](https://github.com/mindcraft-bots/mindcraft),
develop commit `5f3acc87b479864124173de444f31fa5538f94a6`.
The Fabric execution code is a separate implementation using normal client controls
and inventory interactions, not a drop-in copy of Mineflayer skills.

Upstream license:

MIT License

Copyright (c) 2024 Kolby Nottingham

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Baritone 1.17.0 (Fabric / Minecraft 1.21.11)

Separately installed, unmodified binary: https://github.com/cabaletta/baritone/releases/tag/v1.17.0
Source: https://github.com/cabaletta/baritone/tree/v1.17.0
License: LGPL-3.0 (https://github.com/cabaletta/baritone/blob/v1.17.0/LICENSE).
SHA256 of baritone-api-fabric-1.17.0.jar:
`a1646893c2a6338ea6bf1a3bdecf2cd743ede61e31a4324bd79a82f3d03360f9`.
The voice mod uses the public Baritone API; Baritone remains a separate replaceable jar.
Run `node scripts/fetch-baritone.mjs` before building the Fabric mod.
