import "dotenv/config";
import express from "express";
import { createApiApp } from "./server/_core/app";

const app = createApiApp(express());

export default app;
