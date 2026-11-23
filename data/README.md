# data/ 说明

本目录是工作台的**本机私有数据区**，已被 `.gitignore` 整体忽略，不会进入版本库。

| 文件 / 目录 | 内容 | 是否入库 |
| --- | --- | --- |
| `workbench.json` | 学生档案、课次、教材、题库、排期的唯一数据源 | 否 |
| `secrets.json` | 大模型 `baseUrl` / `model` / `apiKey` | 否 |
| `workbench.backup-*.json` | 自动生成的滚动备份 | 否 |
| `files/` | 上传的教材、试卷等原件 | 否 |

约定：

- `server.mjs` 首次启动时会自行创建 `data/` 与 `data/files/`，克隆仓库后无需手动建目录。
- 仅 `README.md` 本身入库，用于说明目录用途。
- 迁移机器时直接整份复制 `data/` 文件夹，或通过界面里的「导出 / 导入」走一遍。
