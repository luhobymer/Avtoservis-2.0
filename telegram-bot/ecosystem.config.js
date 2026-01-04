module.exports = {
  apps: [
    {
      name: 'avtoservis-telegram-bot',
      script: 'bot.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      max_memory_restart: '500M',
      restart_delay: 4000,
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'data'],
      min_uptime: '10s',
      max_restarts: 10,
      kill_timeout: 5000
    }
  ]
};