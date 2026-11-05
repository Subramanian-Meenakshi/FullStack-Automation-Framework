process.env.S3_DEC_KEY_B64 = process.env.S3_DEC_KEY_B64
  || 'GghACJLOTOVwBDBAcYc7fvrfB9XPcB9nuNuMBWTgsQo=';
const { S3_ENDPOINT, S3_BUCKET } = require('../helpers/services');
process.env.S3_ENDPOINT = process.env.S3_ENDPOINT || S3_ENDPOINT;
process.env.S3_BUCKET = process.env.S3_BUCKET || S3_BUCKET;

// Allure Environment widget (small key/value list in the report).
// Written after pretest wipe, before results land; allure-playwright writes no
// environmentInfo of its own, so this file survives the run.
const fs = require('fs');
const path = require('path');

const resultsDir = process.env.ALLURE_RESULTS_DIR || 'reports/allure-results';
fs.mkdirSync(resultsDir, { recursive: true });
fs.writeFileSync(path.join(resultsDir, 'environment.properties'), [
  'Project=FullStack Automation Framework',
  'Author=Subramanian Meenakshi',
  'Contact=Subramanian.Meenakshi@Sandhata.com',
  'Note=feel free to reach out for questions, collaboration or feedback',
].join('\n') + '\n');

module.exports = async () => {};
