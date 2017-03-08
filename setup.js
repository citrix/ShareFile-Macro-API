'use strict';
fs = require('fs');
fs.createReadStream('.env.sample')
  .pipe(fs.createWriteStream('.env'));
