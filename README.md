# 智搭衣橱 MVP

一个以手机端为主的智能衣橱应用原型。

它会结合：

- 实时天气
- 用户自己的衣橱
- 风格偏好与使用反馈

然后给出今天更适合直接穿的搭配，而不是随机拼接。

## 当前已实现

- 手机号验证码登录占位版
- 多用户数据隔离
- SQLite 数据库存储
- 衣物图片独立上传
- 上传图片自动压缩为 `webp`
- 手机端前置图片压缩预处理
- 手机端图片裁图模式：原图 / 衣物卡片 / 正方形
- 删除衣物时同步清理图片文件
- 实时天气拉取
- 规则引擎穿搭推荐
- `换一套`
- `换单件`
- 衣橱录入与状态管理
- 收藏搭配
- 最近穿搭历史
- 历史与收藏的移动端回看面板
- 历史与收藏支持按风格快速筛选
- 移动端优先布局
- 可作为 Web App 添加到手机桌面
- 生产模式由后端直接托管前端静态资源

## 本地运行

```bash
npm run dev
```

当前会同时启动：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:3001`

开发环境登录方式：

- 输入任意 11 位手机号
- 点击获取验证码
- 使用固定验证码 `123456` 登录

## 构建与启动

生产构建：

```bash
npm run build
```

生产启动：

```bash
npm start
```

`npm start` 会启动后端，并托管构建后的前端页面。

## 环境变量

参考 `.env.example`

- `PORT`：服务端口
- `DATABASE_PATH`：SQLite 数据库路径
- `UPLOAD_DIR`：上传目录
- `CORS_ORIGIN`：允许访问的前端来源
- `DEV_LOGIN_CODE`：开发环境固定验证码
- `JSON_LIMIT`：JSON 请求体大小限制
- `VITE_API_BASE_URL`：前端独立部署时的 API 地址
- `SMS_PROVIDER`：验证码服务提供方式
- `SMS_WEBHOOK_URL`：Webhook 短信服务地址
- `SMS_WEBHOOK_TOKEN`：Webhook 鉴权令牌
- `SMS_TEMPLATE_ID`：短信模板标识
- `IMAGE_QUALITY`：上传图片压缩质量

## Docker

项目已经包含：

- `Dockerfile`
- `.dockerignore`

构建镜像：

```bash
docker build -t smart-closet-app .
```

运行容器：

```bash
docker run -p 3001:3001 smart-closet-app
```

## 核心目录

- `src/App.tsx`：主界面、手机端交互、登录流程、历史与收藏
- `src/engine.ts`：穿搭规则引擎
- `src/api.ts`：前端 API 封装
- `src/App.css`：移动端优先样式
- `public/manifest.webmanifest`：手机桌面 Web App 配置
- `server/index.mjs`：后端 API 与静态托管入口
- `server/db.mjs`：SQLite 数据层
- `server/image-service.mjs`：图片压缩、写入与清理
- `server/sms-provider.mjs`：验证码发送抽象层

## 当前推荐逻辑

推荐流程：

1. 根据天气、场景和用户偏好过滤可穿单品
2. 按固定模板生成候选穿搭
3. 从天气、风格、颜色、场景、廓形、偏好六个维度打分
4. 输出主推荐和备选
5. 支持在当前整套基础上替换单件

## 当前限制

- 天气接口目前使用公开 API，缓存和重试策略还比较轻
- 图片仍然存放在本地目录，还没接对象存储
- 短信验证码默认仍是开发占位方案
- 当前部署结构适合 MVP 和测试环境，正式线上化还需要云存储、短信服务和运维配置

## 下一步建议

- 接正式短信服务商
- 接对象存储与 CDN
- 增加图片裁剪、背景处理和衣物识别
- 增强推荐历史筛选与收藏管理
- 补正式部署脚本与云端环境配置
