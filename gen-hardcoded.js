"use strict";
/* this script is used to put the JSON data and weather.js
 * in one file, so that it can be shared on sites such as jsfiddle.net */
let fs = require("fs")
  , process = require("process");

/* files and stuff */
let output = process.stdout;
let root = "./public";
let dataDir = "data";
let basicScript = "weather.js";
let destVar = "hardcoded";

fs.readdir(root + "/" + dataDir, (err, list) => {
  if (err)
    return console.error(err);

  let entries = {};
  let n = 0;

  for (let filename of list) {
    let path = root + "/" + dataDir + "/" + filename;
    if (filename.match(/[^\.]\.json$/)) {
      n++;
      fs.readFile(path, (err,data) => {
        entries[filename.match(/(.+)\.json$/)[1]] = data;
        read_one();
      });
    }
  }

  function read_one () {
    if (--n === 0) {
      finish(entries);
    }
  }
});

function finish (entries) {
  fs.readFile(root + "/" + basicScript, (err,data) => {
    if (err)
      return console.error(err);

    output.write(data);
    output.write("\n\n\n/*** JSON data pulled from files ***/\n");
    output.write(destVar + " = {\n");
    for (let key of Object.keys(entries)) {
      output.write("  " + key + ": " + entries[key] + ",\n");
    }
    output.write("}\n");
  });
}
