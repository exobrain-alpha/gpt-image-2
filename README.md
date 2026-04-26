# GPT-Image-2 图像工作台

一个基于 Next.js 的浏览器图像生成工作台，用于调用 Microsoft Foundry / Azure OpenAI 中部署的 GPT-Image-2。支持 prompt 生成、参考图编辑、历史图片预览，以及从历史列表拖拽图片作为新的参考图。

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Azure OpenAI / Microsoft Foundry REST API

## 环境变量

复制 `.env.example` 为 `.env`，并填写你的 Foundry / Azure OpenAI 配置：

```bash
cp .env.example .env
```

主要配置项：

```env
AZURE_OPENAI_ENDPOINT=https://your-resource.services.ai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
# AZURE_OPENAI_API_VERSION=2025-04-01-preview
```

`AZURE_OPENAI_ENDPOINT` 填资源的 base endpoint，不要填完整 Target URI。应用会自动拼接 `/openai/deployments/...` 路径。

## 安装

```bash
npm install
```

## 开发启动

```bash
npm run dev
```

启动后打开终端输出的开发地址，通常是：

```txt
http://localhost:3000
```

如果 `3000` 端口已被占用，Next.js 会自动使用其他端口。

## 生产构建

```bash
npm run build
npm run start
```

## 常用命令

```bash
npm run lint
npm run build
```

生成结果会保存到项目的 `outputs/` 目录，并通过 `/api/outputs/...` 在应用内展示。
