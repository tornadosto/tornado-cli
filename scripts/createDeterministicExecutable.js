const { exec } = require("pkg");
const fs = require("fs");
const crypto = require('crypto');
const removeNPMAbsolutePaths = require('removeNPMAbsolutePaths');

async function main(){
    // Remove absolute paths from log files and package.json`s in node_modules to ensure reproducible build
    await removeNPMAbsolutePaths(".", { force: true, fields: ["_where", "_args", "man"] });
    await exec(['.', '--target', 'node14-win', '--no-bytecode', '--public-packages', '*', '--public']);
    fs.createReadStream('./tornado-cli.exe').
    pipe(crypto.createHash('sha1').setEncoding('hex')).
    on('finish', function () {
        console.log(this.read());
    })
}

main();