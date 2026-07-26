import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { ensureBootstrapUsers } from "./utils/bootstrap.js";

async function start() {
  await connectDatabase();
  await ensureBootstrapUsers();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`Servidor listo en http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error("No fue posible iniciar el backend.");
  console.error(error);
  process.exit(1);
});
