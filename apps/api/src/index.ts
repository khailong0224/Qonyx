import { createQonyxApp } from "./app.js";

const { app, config } = createQonyxApp();

const server = app.listen(config.port, config.host, () => {
  console.log(`Qonyx API listening on http://${config.host}:${config.port}`);
  console.log(
    `Live trading is ${config.enableLiveTrading ? "enabled" : "disabled"}; paper mode is always available.`,
  );
});

function shutdown(signal: string) {
  console.log(`${signal} received; stopping Qonyx API.`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
