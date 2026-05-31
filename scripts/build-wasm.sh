#!/bin/bash
# 构建 Envify 使用的 tree-sitter WASM 语法文件。
#
# 版本对应关系（ABI 14 兼容）：
#   web-tree-sitter 0.24.6 需要 ABI 13-14 的语法文件。
#   各语法仓库使用最新的 ABI 14 兼容标签。
#
# 用法：
#   bash scripts/build-wasm.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WASM_DIR="$PROJECT_DIR/resources/wasm"

# 各语法仓库的 ABI 14 兼容版本
PYTHON_TAG="v0.23.6"
JAVASCRIPT_TAG="v0.23.1"
TYPESCRIPT_TAG="v0.23.2"

mkdir -p "$WASM_DIR"
TMP_DIR=$(mktemp -d)

echo "构建 tree-sitter-python.wasm (tag: ${PYTHON_TAG})..."
git clone --depth 1 --branch "${PYTHON_TAG}" \
  https://github.com/tree-sitter/tree-sitter-python.git \
  "$TMP_DIR/tree-sitter-python" 2>/dev/null
(cd "$TMP_DIR/tree-sitter-python" && npx tree-sitter-cli build --wasm)
cp "$TMP_DIR/tree-sitter-python/tree-sitter-python.wasm" "$WASM_DIR/"

echo "构建 tree-sitter-javascript.wasm (tag: ${JAVASCRIPT_TAG})..."
git clone --depth 1 --branch "${JAVASCRIPT_TAG}" \
  https://github.com/tree-sitter/tree-sitter-javascript.git \
  "$TMP_DIR/tree-sitter-javascript" 2>/dev/null
(cd "$TMP_DIR/tree-sitter-javascript" && npx tree-sitter-cli build --wasm)
cp "$TMP_DIR/tree-sitter-javascript/tree-sitter-javascript.wasm" "$WASM_DIR/"

echo "构建 tree-sitter-typescript.wasm (tag: ${TYPESCRIPT_TAG})..."
git clone --depth 1 --branch "${TYPESCRIPT_TAG}" \
  https://github.com/tree-sitter/tree-sitter-typescript.git \
  "$TMP_DIR/tree-sitter-typescript" 2>/dev/null
(cd "$TMP_DIR/tree-sitter-typescript/typescript" && npx tree-sitter-cli build --wasm)
cp "$TMP_DIR/tree-sitter-typescript/typescript/tree-sitter-typescript.wasm" "$WASM_DIR/"

echo "构建 tree-sitter-tsx.wasm (tag: ${TYPESCRIPT_TAG})..."
(cd "$TMP_DIR/tree-sitter-typescript/tsx" && npx tree-sitter-cli build --wasm)
cp "$TMP_DIR/tree-sitter-typescript/tsx/tree-sitter-tsx.wasm" "$WASM_DIR/"

rm -rf "$TMP_DIR"

echo "完成！WASM 语法文件位于 ${WASM_DIR}"
ls -la "$WASM_DIR"
