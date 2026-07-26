import { connectDatabase } from "../config/database.js";
import { ensureBootstrapUsers } from "../utils/bootstrap.js";

async function run() {
  await connectDatabase();
  await ensureBootstrapUsers({
    force: true,
    seedStarterContent: false
  });

  console.log("Usuarios base verificados correctamente.");
}

run().catch((error) => {
  console.error("No fue posible verificar los usuarios base.");
  console.error(error);
  process.exit(1);
});
