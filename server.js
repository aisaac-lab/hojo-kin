const { createRequestHandler } = require("@remix-run/express");
const express = require("express");
const { installGlobals } = require("@remix-run/node");
const build = require("./build/index.js");

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