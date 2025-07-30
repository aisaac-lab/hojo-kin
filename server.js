import { createRequestHandler } from "@remix-run/express";
import express from "express";
import { installGlobals } from "@remix-run/node";
import * as build from "./build/index.js";

installGlobals();

const app = express();

// Serve static files from public/build
app.use("/build", express.static("public/build", { immutable: true, maxAge: "1y" }));

// Serve static files from public root
app.use(express.static("public"));

// Remix handler
app.all("*", createRequestHandler({ build, mode: process.env.NODE_ENV }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
});