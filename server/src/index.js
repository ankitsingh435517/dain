// TODO: Add routes for auth
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5500;

app.get("/ping", (_, res) => res.json({ message: "pong" }));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
