require("dotenv").config();

const connectDb = require("./config/db");
const { createApp } = require("./app");
const logger = require("./utils/logger");

const app = createApp();

const port = Number(process.env.PORT) || 5000;

if (require.main === module) {
  connectDb()
    .then(() => {
      app.listen(port, () => {
        logger.info({ port }, "Server listening");
      });
    })
    .catch((error) => {
      logger.error({ err: error }, "Failed to start server");
      process.exit(1);
    });
}

module.exports = { app };
