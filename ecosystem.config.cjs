module.exports = {
  apps: [
    {
      name: 'smart-closet',
      script: 'npm',
      args: 'run start:prod',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '700M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
