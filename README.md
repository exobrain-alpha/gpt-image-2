# GPT-Image-2 图像工作台

一个基于 Next.js 的浏览器图像生成工作台，用于调用 Microsoft Foundry / Azure OpenAI 中部署的 GPT-Image-2。支持提示词输入、智能提示词生成与优化、参考图编辑、历史图片预览，以及从历史列表拖拽图片作为新的参考图。

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Azure OpenAI / Microsoft Foundry REST API
- Claude on Microsoft Foundry，用于智能提示词助手

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
# OUTPUT_DIRECTORY=outputs

AZURE_CLAUDE_ENDPOINT=
AZURE_CLAUDE_API_KEY=
AZURE_CLAUDE_DEPLOYMENT_NAME=claude-opus-4-7
```

`AZURE_OPENAI_ENDPOINT` 填资源的 base endpoint，不要填完整 Target URI。应用会自动拼接 `/openai/deployments/...` 路径。

`OUTPUT_DIRECTORY` 用于自定义生成图片和元数据的父级目录。无论填写相对路径还是绝对路径，最终都会落到名为 `outputs` 的目录中：

- 未设置：`项目根目录/outputs`
- `OUTPUT_DIRECTORY=outputs`：`项目根目录/outputs`
- `OUTPUT_DIRECTORY=custom-data`：`项目根目录/custom-data/outputs`
- `OUTPUT_DIRECTORY=/data/gpt-image-2`：`/data/gpt-image-2/outputs`

启用“智能提示词”功能时，需要填写 Claude 在 Microsoft Foundry 中的部署信息。`AZURE_CLAUDE_ENDPOINT` 可以填写资源 base endpoint、`/anthropic` base URL，或完整 `/anthropic/v1/messages` Target URI。

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

## PM2 启动

项目包含 `ecosystem.config.cjs`，生产环境可以用 PM2 托管：

```bash
npm run build
pm2 start ecosystem.config.cjs
```

## 输出文件

生成结果会保存到最终解析出的 `outputs/` 目录，并通过 `/api/outputs/...` 在应用内展示。

每次生成会写入：

- 生成图片文件
- 同名 JSON 元数据文件
- 使用参考图时，额外保存同 ID 的 `-reference` 参考图文件

JSON 元数据会记录提示词、参考图文件名、生成选项、输出文件路径和模型调用上下文。

## 常用命令

```bash
npm run lint
npm run build
```
