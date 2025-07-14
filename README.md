# Tornado-CLI

Command line tool to interact with [Tornado Cash protocol](https://docs.tornado.ws).

### How to install Tornado CLI

##### Simple installation for Windows users:

Download archive file from this git: https://git.tornado.ws/tornadocash/tornado-cli/archive/master.zip

Extract it and you can run CLI executable file (but don't move it from this directory): `tornado-cli.exe -h`

##### Advanced installation (for professional users, any platform):

Download and install [node.js](https://nodejs.org/en/download/).

You also need to install C++ build tools in order to do 'npm install', for more information please checkout https://github.com/nodejs/node-gyp#on-unix.

- For Windows: https://stackoverflow.com/a/64224475

- For MacOS: Install XCode Command Line Tools

- For Linux: Install make & gcc, for ubuntu `$ sudo apt-get install -y build-essentials`

If you have git installed on your system, clone the master branch.

```bash
$ git clone https://git.tornado.ws/tornadocash/tornado-cli
```

Or, download the archive file from git: https://git.tornado.ws/tornadocash/tornado-cli/archive/master.zip

After downloading or cloning the repository, you must install necessary libraries using the following command.

```bash
$ cd tornado-cli
$ npm install
```

And you can run it with command `node cli.js -h`. Note, that in examples below I'll use commands with `tornado-cli.exe` calls for unexperienced users, you should always change `tornado-cli.exe` to `node cli.js`, if you want to use JS version (they are the same anyway).

### Safety instructions

##### Connections

If you want to use Tor connection to conceal ip address, install [Tor Browser](https://www.torproject.org/download/) and add `--tor-port 9150` for `cli.js` if you connect tor with browser. (For non tor-browser tor service you can use the default 9050 port).

Note that you should reset your tor connection by restarting the browser every time when you deposit & withdraw otherwise you will have the same exit node used for connection.

Also, you can use VPN for CLI without Tor or even combine it.

##### Source verification for experienced users

All code logic located in `cli.js`, other files is just testing scripts or static files. You can check or change any part of the code and at next `node cli.js` run changes will apply.

Any user can check that the precompiled `tornado-cli.exe` matches the source code. To verify **tornado-cli.exe**:

1. Build docker image from latest commit: `docker build -t tornado-cli .`
2. Create container`docker create --name tornado-cli tornado-cli:latest`
3. Copy executable from container `docker cp tornado-cli:/home/root/tornado-cli/tornado-cli.exe tornado-cli-verify.exe`
4. Compare hashes of original tornado-cli.exe and freshly generated executable with two commands: on Windows use `CertUtil -hashfile tornado-cli.exe SHA256` and `CertUtil -hashfile tornado-cli-verify.exe SHA256`, on Linux - `sha256sum tornado-cli.exe` and `sha256sum tornado-cli-verify.exe`. Hashes should be identical.

### Commands and usage

1. Run `tornado-cli.exe --help` and check available commands with arguments
3. Add `PRIVATE_KEY` to `.env` file (optional, only if you want to use it for many operations) - open `.env.example` file, add private key after `PRIVATE_KEY=` and rename file to `.env`.

#### To deposit:

```bash
tornado-cli.exe deposit <currency> <amount> [chain_id] --private-key <private key> --rpc <rpc link>
```

Use `--private-key <private key>` only if you didn't add it to `.env` file.

Option `--rpc` is optional, if you select `chain_id` and wouldn't provide it, it will be automatically selected from list of default RPCs.

##### Example:

```bash
$ tornado-cli.exe deposit ETH 0.1 1

Your note: tornado-eth-0.1-1-0xf73dd6833ccbcc046c44228c8e2aa312bf49e08389dadc7c65e6a73239867b7ef49c705c4db227e2fadd8489a494b6880bdcb6016047e019d1abec1c7652
Tornado ETH balance is 8.9
Sender account ETH balance is 103.470619891361352542
Submitting deposit transaction
Tornado ETH balance is 9
Sender account ETH balance is 103.361652048361352542
```

#### To withdraw:

```bash
$ node cli.js withdraw <note> <recipient> --rpc <rpc url> --relayer <relayer url> --private-key <private key>
```

Note that `--relayer <relayer url>`, `--tor <torPort>` and `--rpc <rpc url>` are optional parameters, and use `--private-key <private key>` only if you want to withdraw without relayer.
If you won't provide RPC link, withdrawal will be made via default RPC for the chain to which note belongs.

If you won't provide relayer link, it will be automatically select from all registered relayers using official relayer selection formula.

If you want to compare relayers info and select by yourself, you can use `listRelayers` command to get list of available relayers for your chain or just don't specify relayer at all - it will fetch relayer autimatic, as in UI.

If you don't need relayer while doing withdrawals, you must provide your withdrawal account's private key - either as parameter, or by adding it to `.env` file.

##### Example:

```bash
$ tornado-cli.exe withdraw tornado-eth-0.1-1-0xf73dd6833ccbcc046c44228c8e2aa312bf49e08389dadc7c65e6a73239867b7ef49c705c4db227e2fadd8489a494b6880bdcb6016047e019d1abec1c7652 0x8589427373D6D84E98730D7795D8f6f8731FDA16

Relay address:  0x6A31736e7490AbE5D5676be059DFf064AB4aC754
Getting current state from tornado contract
Generating SNARK proof
Proof time: 9117.051ms
Sending withdraw transaction through relay
Transaction submitted through the relay. View transaction on etherscan https://etherscan.io/tx/0xcb21ae8cad723818c6bc7273e83e00c8393fcdbe74802ce5d562acad691a2a7b
Transaction mined in block 17036120
Done
```

### (Optional) Creating Deposit Notes & Invoices offline

One of the main features of tornado-cli is that it supports creating deposit notes & invoices inside the offline computing environment.

After the private-key like notes are backed up somewhere safe, you can copy the created deposit invoices and use them to create new deposit transaction on online environment.

#### To create deposit notes with `createNote` command.

```bash
$ node cli.js createNote <currency> <amount> <chainId>
```

To find out chainId value for your network, refer to https://chainlist.org/.

##### Example:

```bash
$ node cli.js createNote ETH 0.1 5
Your note: tornado-eth-0.1-5-0x1d9771a7b9f8b6c03d33116208ce8db1aa559d33e65d22dd2ff78375fc6b635f930536d2432b4bde0178c72cfc79d6b27023c5d9de60985f186b34c18c00
Your invoice for deposit: tornadoInvoice-eth-0.1-5-0x1b680c7dda0c2dd1b85f0fe126d49b16ed594b3cd6d5114db5f4593877a6b84f
Backed up deposit note as ./backup-tornado-eth-0.1-5-0x1d9771a7.txt
Backed up invoice as ./backup-tornadoInvoice-eth-0.1-5-0x1b680c7d.txt
```

#### To create corresponding deposit transaction with `depositInvoice` command.

Creating deposit transaction with `depositInvoice` only requires valid deposit note created by `createNote` command, so that the deposit note could be stored without exposed anywhere.

```bash
$ node cli.js depositInvoice <invoice> --rpc <rpc url> --tor <tor port>
```

Parameter `--rpc <rpc url>` is optional, if you don't provide it, default RPC (corresponding to note chain) will be used.

##### Example:

```bash
node cli.js depositInvoice tornadoInvoice-eth-0.1-5-0x1b680c7dda0c2dd1b85f0fe126d49b16ed594b3cd6d5114db5f4593877a6b84f --rpc https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161 --tor 9150
Using tor network
Your remote IP address is xx.xx.xx.xx from xx.
Creating ETH 0.1 deposit for Goerli network.
Using supplied invoice for deposit
Tornado contract balance is xxx.x ETH
Sender account balance is x.xxxxxxx ETH
Submitting deposit transaction
Submitting transaction to the remote node
View transaction on block explorer https://goerli.etherscan.io/tx/0x6ded443caed8d6f2666841149532c64bee149a9a8e1070ed4c91a12dd1837747
Tornado contract balance is xxx.x ETH
Sender account balance is x.xxxxxxx ETH
```
