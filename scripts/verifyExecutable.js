const { exec } = require("pkg");
const fs = require("fs");
const crypto = require('crypto');
const removeNPMAbsolutePaths = require('removeNPMAbsolutePaths');


function getFileHash(filePath){
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath).
        pipe(crypto.createHash('sha1').setEncoding('hex')).
        on('finish', function () {
            resolve(this.read())
        })
    })
}


async function main(){
    await removeNPMAbsolutePaths(".", { force: true, fields: ["_where", "_args", "man"] });
    console.log("Tornado CLI official executable SHA1 hash: ", await getFileHash("./tornado-cli.exe"));

    const testExecutablePath = "./tornado-cli-test.exe";
    await exec(['.', '--target', 'node14-win', '--no-bytecode', '--public-packages', '*', '--public', '-o', testExecutablePath]);
    console.log("Hash of freshly build CLI executable: ", await getFileHash(testExecutablePath));
    fs.rmSync(testExecutablePath, {force: true});
}

main();