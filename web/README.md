# 滑坡监测系统 v1.0

基于RK2206单片机和华为云IoT平台的实时滑坡监测解决方案。

## 产品文档

**完整产品文档**: [滑坡监测系统产品文档.md](./滑坡监测系统产品文档.md)

该文档包含：
- 产品概述和技术规格
- 系统架构和数据流
- 完整部署指南
- 配置管理和API文档
- 运维管理和故障排除
- 安全规范和最佳实践

## 核心功能

- **实时数据采集**: 24/7不间断监测温度、湿度、加速度、陀螺仪等多维度数据
- **云端数据处理**: 自动接收华为云IoT推送数据并存储到Supabase数据库
- **可视化展示**: Next.js前端实时展示监测数据和趋势分析
- **异常告警**: 智能阈值监测和预警通知
- **高可用性**: 99.9%系统可用性保证

## 系统架构

```
RK2206设备 → 华为云IoT → HTTP推送 → nginx → Node.js服务 → Supabase → Next.js前端
```

## 项目结构

```
Landslide_monitor/
├── frontend/                           # Next.js前端应用
│   ├── app/                           # 应用页面和组件
│   ├── lib/                           # 工具库和配置
│   └── package.json                   # 前端依赖
├── backend/                           # 后端服务集合
│   ├── package.json                   # 后端统一管理
│   └── iot-service/                   # IoT数据接收服务
│       ├── iot-server.js              # 主服务文件
│       ├── package.json               # 服务依赖
│       ├── start.sh                   # 启动脚本
│       └── .env.template              # 环境变量模板
├── 滑坡监测系统产品文档.md              # 完整产品文档
└── README.md                          # 项目说明（本文件）
```

## 快速开始

### 1. 环境要求
- Ubuntu 18.04+
- Node.js 18+
- nginx 1.18+
- Supabase账号

### 2. 部署IoT服务
```bash
# 进入IoT服务目录
cd backend/iot-service

# 安装依赖
npm install

# 配置Supabase连接
nano iot-server.js
# 修改 SUPABASE_URL 和 SUPABASE_ANON_KEY

# 启动服务
./start.sh
```

### 3. 配置nginx
```bash
# 编辑nginx配置
sudo nano /etc/nginx/sites-available/landslide-monitor

# 添加IoT服务转发配置
location /iot/ {
    proxy_pass http://127.0.0.1:5100;
    # ... 其他配置
}

# 重新加载nginx
sudo nginx -t && sudo systemctl reload nginx
```

### 4. 华为云IoT配置
在华为云IoT平台配置数据转发：
- **URL**: `http://your-domain.com:1020/iot/huawei`
- **方法**: POST
- **Content-Type**: application/json

## 当前状态

**IoT数据接收服务**: 已完成并测试通过
**数据库集成**: Supabase配置完成
**网络配置**: nginx反向代理正常
**华为云对接**: 支持标准IoT数据格式
**文档完善**: 提供完整产品文档

## 服务管理

```bash
# 进入管理目录
cd backend

# 服务控制
npm run start:iot      # 启动IoT服务
npm run stop:iot       # 停止IoT服务
npm run restart:iot    # 重启IoT服务
npm run logs:iot       # 查看日志
npm run status         # 查看状态

# 健康检查
curl http://localhost:5100/health
```

## API接口

### 健康检查
```bash
GET /health
```

### IoT数据接收
```bash
POST /iot/huawei
Content-Type: application/json
```

### 服务信息
```bash
GET /info
```

## 测试验证

```bash
# 测试健康检查
curl http://localhost:5100/health

# 测试数据接收
curl -X POST http://your-domain.com:1020/iot/huawei \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "device.property",
    "event": "report",
    "notify_data": {
      "header": {"device_id": "test-001"},
      "body": {
        "services": [{
          "service_id": "sensor_data",
          "properties": {"temperature": 25.5}
        }]
      }
    }
  }'
```

## 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| **前端** | Next.js | 14+ |
| **后端** | Node.js + Express | 18+ |
| **数据库** | Supabase (PostgreSQL) | - |
| **云平台** | 华为云IoT | - |
| **反向代理** | nginx | 1.18+ |
| **设备** | RK2206 | - |

## 故障排除

常见问题请参考产品文档中的故障排除章节，或使用以下快速诊断：

```bash
# 检查服务状态
npm run status

# 查看错误日志
npm run logs:iot | grep "ERROR\|❌"

# 检查端口占用
sudo netstat -tlnp | grep :5100

# 测试数据库连接
curl http://localhost:5100/health
```

## 技术支持

- **完整文档**: [滑坡监测系统产品文档.md](./滑坡监测系统产品文档.md)
- **配置模板**: `backend/iot-service/.env.template`
- **服务日志**: `backend/iot-service/server.log`

## 许可证

MIT License

---

**版本**: v1.0.0  
**发布日期**: 2025年7月17日  
**状态**: 生产就绪
