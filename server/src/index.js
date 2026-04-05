require("dotenv").config();

const connectDb = require("./config/db");
const { createApp } = require("./app");

const app = createApp();

const port = process.env.PORT || 5000;

if (require.main === module) {
  connectDb().then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  });
}

module.exports = { app };
