import "dotenv/config";
import express from "express";
import { createApiApp } from "./dist/vercel-app.js";

const app = createApiApp(express());

export default app;
