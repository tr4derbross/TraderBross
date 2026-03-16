module.exports = {
  apps: [
    {
      name: "traderbross-backend",
      script: "./server.mjs",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        API_HOST: "0.0.0.0",
        API_PORT: "4001",
      },
    },
  ],
};
