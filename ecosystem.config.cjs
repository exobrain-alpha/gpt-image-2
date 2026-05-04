module.exports = {
  apps: [
    {
      name: "gpt-image-2", // PM2 中显示的应用名称
      cwd: __dirname, // 将当前配置文件所在目录作为应用工作目录
      script: "npm", // 使用 npm 命令启动应用
      args: "run start", // 执行 package.json 中的 start 脚本
      exec_mode: "fork", // 使用单进程 fork 模式运行
      instances: 1, // 启动 1 个应用实例
      autorestart: true, // 进程异常退出后自动重启
      watch: false, // 不监听文件变化，避免生产环境频繁重启
      time: true, // 在 PM2 日志中显示时间戳
      env: {
        NODE_ENV: "production", // 设置为生产环境运行
      },
    },
  ],
};
