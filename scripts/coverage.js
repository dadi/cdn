#! /usr/bin/env node

var fs = require('fs');
var path = require('path');

var coberturaBadger = require('istanbul-cobertura-badger');

var opts = {
  badgeFileName: "coverage",
  destinationDir: __dirname,
  istanbulReportFile: path.resolve(__dirname + "/../coverage", "cobertura-coverage.xml"),
  thresholds: {
    excellent: 90, // overall percent >= excellent, green badge
    good: 60 // overall percent < excellent and >= good, yellow badge
    // overall percent < good, red badge
  }
};

//console.log(opts);

// Load the badge for the report$
coberturaBadger(opts, function parsingResults(err, badgeStatus) {
  if (err) {
    console.log("An error occurred: " + err.message);
  }

  console.log(badgeStatus);

  var readme = path.resolve(__dirname + '/../README.md');
  var badgeUrl = badgeStatus.url; // e.g. http://img.shields.io/badge/coverage-60%-yellow.svg

  // open the README.md and add this url
  fs.readFile(readme, {encoding: 'utf-8'}, function (err, body) {
      body = body.replace(/(!\[coverage\]\()(.+?)(\))/g, function(whole, a, b, c) {
        return a + b + '?style=flat-square' + c;
      });

      fs.writeFile(readme, body, {encoding: 'utf-8'}, function (err) {
        if (err) console.log(err.toString());

        console.log("Coverage badge successfully added to " + readme);
      });
  })

  //console.log(badgeStatus);
});

