"use strict";
/* just set up web server using http-server */
let httpserver = require("http-server");
let colors = require("colors");

let PORT = 8080;
let server = httpserver.createServer();

server.listen(PORT, _ => {
  console.log("static http server on port ".white + PORT.toString().green.bold);
});
