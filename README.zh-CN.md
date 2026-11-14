# Minecraft MCP Player：让 Codex 控制你本人

这是基于 [yuniko-software/minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server) 修改的项目，新增 Fabric 执行端，让 MCP 控制 **Minecraft Java 里你自己的角色**。

- 支持单人世界，不用对局域网开放、不用专用服务器。
- 不添加另一个机器人角色，不需要浏览器画面。
- 保留原项目的 22 个工具，另加状态查询和停止，共 24 个工具。
- 不绑定语音大模型；可以直接接 Codex。这个仓库只发布 MCP 和配套 Fabric 模组，不包含此前的语音窗口。

## 已验证范围

项目使用者已用 **Codex + 生存模式** 实际试玩，确认能够自行收集物品，并反馈操作比较顺畅。
开发时另做过本人跳跃、方块查询、停止的实机检查；22 个原有工具全部通过模拟 Fabric 端的接口映射检查。接口检查不等于每个玩法都做过实机测试。复杂建筑、任意配方和所有地形的可靠性仍未保证。

## 安装

完整命令和 Codex 配置见 [英文 README](README.md#install-and-build)。需要：

1. Minecraft Java **1.21.11**、Fabric Loader **0.18.4**、Fabric API **0.141.6+1.21.11**。
2. Java **21**、推荐 Node.js **22+**。
3. 在仓库根目录运行 `npm ci`、`npm run build` 和 `node scripts/fetch-baritone.mjs`。
4. 进入 `fabric-mod`，在 Windows 运行 `gradlew.bat build`。
5. 把生成的 `astra-voice-1.0.0.jar`、单独的 Baritone API 1.17.0 jar 和对应 Fabric API 放进实际游戏实例的 `mods` 目录。
6. 在仓库根目录运行 `node scripts/init-player-config.mjs "你的游戏实例目录"`，生成本地配对配置。它不会覆盖已有文件。
7. 按英文 README 的示例添加 Codex MCP 配置。路径必须换成你的实际路径；使用 `--control player` 和 `--player-config` 参数。
8. 完全重启 Codex，使用运行游戏的这台电脑上的本地会话，进入 Fabric 单人世界并关闭菜单。

MCP 本身不用模型 API Key。Codex 提供规划能力，通过标准 MCP 获取工具清单并调用。配对文件 `config/astra-voice.json` 是本地凭证，不要上传。

## 操作

推荐先在生存模式说：

> 用 minecraft MCP 读取我的状态和背包，然后跳一下，根据实际返回结果确认。

确认连通后：

> 收集木头，制作工作台和木镐。每一步检查实际结果，遇到问题就告诉我。

游戏里 **F9 停止并禁用控制，F8 重新启用**。MCP 的 `stop-actions` 只取消当前动作。重新连接或手动停止后可能需要 F8。切到 Codex 后若游戏暂停，可在游戏中用 F3+P 关闭失去焦点时暂停。关闭菜单再执行动作。

同一个本地桥接端口只能有一个执行服务；使用 Codex 时，关闭其他占用桥接的语音窗口。无法连接时查看 `/astra status`，必要时运行 `/astra connect`。

原项目的机器人模式仍保留，因此不传 `--control player` 会启动原先的 Mineflayer 模式。新安装不需要额外下载旧语音项目，也不需要配置 `MINECRAFT_PLAYER_PROJECT`。

飞行需要玩家本来就拥有飞行权限；生存模式不会因此获得飞行或作弊能力。寻路受地形影响；工具列表并不代表已支持自动战斗、完整箱子管理和可靠的大型自动建造。

## 来源与许可证

保留原 MCP 的 Apache-2.0 许可证、提交历史和 [原说明](README.upstream.md)。Fabric 控制器参考并改造自 `tommywalteryespls-bit/minecraft-ai-player`，保留 MIT 许可证。Mindcraft 参考资料、独立 Baritone 依赖及许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。不包含存档、账号、API Key 或本机配置。
