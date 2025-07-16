#!/bin/bash

# 滑坡监测系统部署脚本

set -e

echo "🚀 开始部署滑坡监测系统..."

# 检查Docker和Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p ./mosquitto/config
mkdir -p ./mosquitto/data
mkdir -p ./mosquitto/log
mkdir -p ./logs
mkdir -p ./backups

# 创建Mosquitto配置文件
echo "⚙️ 配置MQTT服务器..."
cat > ./mosquitto/config/mosquitto.conf << EOF
# Mosquitto配置文件
listener 1883
allow_anonymous true
persistence true
persistence_location /mosquitto/data/
log_dest file /mosquitto/log/mosquitto.log
log_type error
log_type warning
log_type notice
log_type information

# WebSocket支持
listener 9001
protocol websockets
EOF

# 检查环境变量文件
if [ ! -f .env ]; then
    echo "⚠️ 未找到 .env 文件，从示例文件复制..."
    cp .env.example .env
    echo "📝 请编辑 .env 文件，填入正确的配置信息"
    echo "   特别是以下配置项："
    echo "   - POSTGRES_PASSWORD"
    echo "   - HUAWEI_IOT_ENDPOINT"
    echo "   - HUAWEI_IOT_APP_ID"
    echo "   - HUAWEI_IOT_SECRET"
    read -p "配置完成后按回车继续..."
fi

# 构建前端应用
echo "🔨 构建前端应用..."
cd ..
npm install
npm run build
cd deploy

# 停止现有服务
echo "🛑 停止现有服务..."
docker-compose down

# 清理旧的镜像（可选）
read -p "是否清理旧的Docker镜像？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧹 清理旧镜像..."
    docker system prune -f
fi

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d --build

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 检查数据库连接
echo "🔗 检查数据库连接..."
if docker-compose exec -T postgres pg_isready -U postgres; then
    echo "✅ 数据库连接正常"
else
    echo "❌ 数据库连接失败"
    exit 1
fi

# 显示访问信息
echo ""
echo "🎉 部署完成！"
echo ""
echo "📊 前端访问地址: http://localhost:3000"
echo "🔧 命令服务API: http://localhost:8080"
echo "📡 MQTT服务器: localhost:1883"
echo "🗄️ 数据库: localhost:5432"
echo ""
echo "📋 服务状态检查:"
echo "   docker-compose ps"
echo ""
echo "📝 查看日志:"
echo "   docker-compose logs -f [service_name]"
echo ""
echo "🛑 停止服务:"
echo "   docker-compose down"
echo ""

# 创建备份脚本
cat > backup.sh << 'EOF'
#!/bin/bash
# 数据库备份脚本

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/landslide_monitor_$DATE.sql"

echo "开始备份数据库..."
docker-compose exec -T postgres pg_dump -U postgres landslide_monitor > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ 备份成功: $BACKUP_FILE"
    
    # 保留最近7天的备份
    find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
    echo "🧹 清理了7天前的备份文件"
else
    echo "❌ 备份失败"
    exit 1
fi
EOF

chmod +x backup.sh

echo "💾 已创建数据库备份脚本: ./backup.sh"
echo ""
echo "🔄 建议设置定时备份:"
echo "   crontab -e"
echo "   添加: 0 2 * * * /path/to/deploy/backup.sh"
