module.exports = {
  apps: [
    {
      name: 'landslide-monitor',
      script: 'npm',
      args: 'start',
      cwd: '/path/to/your/landslide-monitor', // 修改为实际路径
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};
