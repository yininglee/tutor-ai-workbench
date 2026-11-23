#!/bin/bash
# 家教老师 AI 工作台 —— 启动脚本
# 双击即可运行；关闭终端窗口或按 Ctrl+C 停止服务（数据已实时保存）

cd "$(dirname "$0")" || exit 1

find_node() {
  for p in "$(command -v node 2>/dev/null)" \
           /opt/homebrew/bin/node \
           /usr/local/bin/node \
           "$HOME/.workbuddy/binaries/node/versions/"*/bin/node \
           "$HOME/.nvm/versions/node/"*/bin/node; do
    if [ -n "$p" ] && [ -x "$p" ]; then echo "$p"; return 0; fi
  done
  return 1
}

NODE_BIN="$(find_node)"
if [ -z "$NODE_BIN" ]; then
  echo ""
  echo "  没有找到 Node.js。"
  echo "  请先安装 Node.js（https://nodejs.org 下载 LTS 版本），再双击本文件。"
  echo ""
  read -r -p "  按回车关闭…" _
  exit 1
fi

echo ""
echo "  正在启动家教老师 AI 工作台…"
echo "  （首次打开会自动弹出浏览器，若没有请手动访问 http://127.0.0.1:5173）"
echo ""

"$NODE_BIN" server.mjs

echo ""
echo "  服务已停止。数据已保存在 data/workbench.json"
read -r -p "  按回车关闭窗口…" _
