#!/bin/bash

echo "🚀 华为云IoT设备控制功能快速部署脚本"
echo "========================================"

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 安装依赖
echo ""
echo "📦 安装依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 依赖安装成功"

# 检查配置文件
echo ""
echo "🔧 检查配置文件..."

if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在，从模板创建..."
    cp .env.example .env
    echo "✅ .env 文件已创建"
fi

# 测试认证
echo ""
echo "🧪 测试华为云认证..."
node test-auth.js

if [ $? -ne 0 ]; then
    echo "❌ 认证测试失败，请检查 .env 文件中的配置"
    echo ""
    echo "当前配置:"
    cat .env
    exit 1
fi

echo "✅ 认证测试成功"

# 启动服务器
echo ""
echo "🌟 启动IoT服务器..."
echo "服务器将在 http://localhost:5100 启动"
echo "按 Ctrl+C 停止服务器"
echo ""

node iot-server.js
