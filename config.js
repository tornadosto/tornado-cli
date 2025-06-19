require('dotenv').config();

module.exports = {
  deployments: {
    netId1: {
      tokens: {
        eth: {
          instanceAddress: {
            0.1: '0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc',
            1: '0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936',
            10: '0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF',
            100: '0xA160cdAB225685dA1d56aa342Ad8841c3b53f291'
          },
          deployedBlockNumber: {
            0.1: 9116966,
            1: 9117609,
            10: 9117720,
            100: 9161895
          },
          miningEnabled: true,
          symbol: 'ETH',
          decimals: 18
        },
        dai: {
          instanceAddress: {
            100: '0xD4B88Df4D29F5CedD6857912842cff3b20C8Cfa3',
            1000: '0xFD8610d20aA15b7B2E3Be39B396a1bC3516c7144',
            10000: '0x07687e702b410Fa43f4cB4Af7FA097918ffD2730',
            100000: '0x23773E65ed146A459791799d01336DB287f25334'
          },
          deployedBlockNumber: {
            100: 9117612,
            1000: 9161917,
            10000: 12066007,
            100000: 12066048
          },
          miningEnabled: true,
          tokenAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          symbol: 'DAI',
          decimals: 18,
          gasLimit: '55000'
        },
        cdai: {
          instanceAddress: {
            5000: '0x22aaA7720ddd5388A3c0A3333430953C68f1849b',
            50000: '0x03893a7c7463AE47D46bc7f091665f1893656003',
            500000: '0x2717c5e28cf931547B621a5dddb772Ab6A35B701',
            5000000: '0xD21be7248e0197Ee08E0c20D4a96DEBdaC3D20Af'
          },
          deployedBlockNumber: {
            5000: 9161938,
            50000: 12069037,
            500000: 12067606,
            5000000: 12066053
          },
          miningEnabled: true,
          tokenAddress: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
          symbol: 'cDAI',
          decimals: 8,
          gasLimit: '425000'
        },
        usdc: {
          instanceAddress: {
            100: '0xd96f2B1c14Db8458374d9Aca76E26c3D18364307',
            1000: '0x4736dCf1b7A3d580672CcE6E7c65cd5cc9cFBa9D'
          },
          deployedBlockNumber: {
            100: 9161958,
            1000: 9161965
          },
          miningEnabled: false,
          tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          symbol: 'USDC',
          decimals: 6,
          gasLimit: '80000'
        },
        usdt: {
          instanceAddress: {
            100: '0x169AD27A470D064DEDE56a2D3ff727986b15D52B',
            1000: '0x0836222F2B2B24A3F36f98668Ed8F0B38D1a872f'
          },
          deployedBlockNumber: {
            100: 9162005,
            1000: 9162012
          },
          miningEnabled: false,
          tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          symbol: 'USDT',
          decimals: 6,
          gasLimit: '100000'
        },
        wbtc: {
          instanceAddress: {
            0.1: '0x178169B423a011fff22B9e3F3abeA13414dDD0F1',
            1: '0x610B717796ad172B316836AC95a2ffad065CeaB4',
            10: '0xbB93e510BbCD0B7beb5A853875f9eC60275CF498'
          },
          deployedBlockNumber: {
            0.1: 12067529,
            1: 12066652,
            10: 12067591
          },
          miningEnabled: true,
          tokenAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
          symbol: 'WBTC',
          decimals: 8,
          gasLimit: '85000'
        }
      },
      ensSubdomainKey: 'mainnet-tornado',
      firstDeploymentTransaction: "0xeed4367a9b4c066b9fbf0a44869f36b93d2f06e5a63a9464ddfd0597a8a45935",
      relayerRegistry: "0x58E8dCC13BE9780fC42E8723D8EaD4CF46943dF2",
      relayerRegistryDeployedBlockNumber: 14173129,
      relayerAggregator: '0xE8F47A78A6D52D317D0D2FFFac56739fE14D1b49',
      proxy: '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b',
      multicall: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441',
      subgraphs: ['https://gateway.thegraph.com/api/6a217817dd87d33db10beed79b044a91/subgraphs/id/Ec6fVMDVqXTDQZ3c4jxcyV3zBXqkdgMWfhdtCgtqn7Sh', 
                  'https://gateway.thegraph.com/api/8b164501e1862078eff5fb9dda136c6c/subgraphs/id/Ec6fVMDVqXTDQZ3c4jxcyV3zBXqkdgMWfhdtCgtqn7Sh', 
                  'https://tornadocash-rpc.com/subgraphs/name/tornadocash/mainnet-tornado-subgraph'],
      relayerSubgraphs: ['https://gateway.thegraph.com/api/6a217817dd87d33db10beed79b044a91/subgraphs/id/DgKwfAbLfynpiq7fDJy59LDnVnia4Y5nYeRDBYi9qezc', 'https://gateway.thegraph.com/api/8b164501e1862078eff5fb9dda136c6c/subgraphs/id/DgKwfAbLfynpiq7fDJy59LDnVnia4Y5nYeRDBYi9qezc', 'https://tornadocash-rpc.com/subgraphs/name/tornadocash/tornado-relayer-registry'],
      defaultRpcs: ['https://ethereum.blockpi.network/v1/rpc/public', 
                    'https://eth.drpc.org', 
                    'https://ethereum-rpc.publicnode.com', 
                    'https://mainnet.chainnodes.org/3ae3d849-a613-4917-a56e-080f181aa4da', 
                    'https://tornadocash-rpc.com']
    },
    netId56: {
      tokens: {
        bnb: {
          instanceAddress: {
            0.1: '0x84443CFd09A48AF6eF360C6976C5392aC5023a1F',
            1: '0xd47438C816c9E7f2E2888E060936a499Af9582b3',
            10: '0x330bdFADE01eE9bF63C209Ee33102DD334618e0a',
            100: '0x1E34A77868E19A6647b1f2F47B51ed72dEDE95DD'
          },
          deployedBlockNumber: {
            0.1: 8159279,
            1: 8159286,
            10: 8159290,
            100: 8159296
          },
          miningEnabled: false,
          symbol: 'BNB',
          decimals: 18
        }
      },
      ensSubdomainKey: 'bsc-tornado',
      firstDeploymentTransaction: '0x0a10d19264c8b9033ea5f71242b160f6b4864663ea3c52594bec186d848de2c6',
      proxy: '0x0D5550d52428E7e3175bfc9550207e4ad3859b17',
      multicall: '0x41263cBA59EB80dC200F3E2544eda4ed6A90E76C',
      subgraphs: ['https://gateway.thegraph.com/api/6a217817dd87d33db10beed79b044a91/subgraphs/id/CiwGzefDBZCavXRPnwarnnF8xDDoLw4boBuySomJWYnV', 'https://tornadocash-rpc.com/subgraphs/name/tornadocash/bsc-tornado-subgraph', 'https://gateway.thegraph.com/api/8b164501e1862078eff5fb9dda136c6c/subgraphs/id/CiwGzefDBZCavXRPnwarnnF8xDDoLw4boBuySomJWYnV'],
      defaultRpcs: ['https://bsc-rpc.publicnode.com', 
                    'https://endpoints.omniatech.io/v1/bsc/mainnet/public', 
                    'https://bsc-mainnet.chainnodes.org/3ae3d849-a613-4917-a56e-080f181aa4da', 
                    'https://bsc-dataseed1.ninicoin.io', 
                    'https://bsc.drpc.org', 
                    'https://bsc-mainnet.public.blastapi.io']
    },
    netId100: {
      tokens: {
        xdai: {
          instanceAddress: {
            100: '0x1E34A77868E19A6647b1f2F47B51ed72dEDE95DD',
            1000: '0xdf231d99Ff8b6c6CBF4E9B9a945CBAcEF9339178',
            10000: '0xaf4c0B70B2Ea9FB7487C7CbB37aDa259579fe040',
            100000: '0xa5C2254e4253490C54cef0a4347fddb8f75A4998'
          },
          deployedBlockNumber: {
            100: 17754566,
            1000: 17754568,
            10000: 17754572,
            100000: 17754574
          },
          miningEnabled: false,
          symbol: 'xDAI',
          decimals: 18
        }
      },
      ensSubdomainKey: 'gnosis-tornado',
      firstDeploymentTransaction: '0x8d7c57f31b83d32e9f3099f839a1b94f60a0039983fb0ecad4d52fa45898288f',
      proxy: '0x0D5550d52428E7e3175bfc9550207e4ad3859b17',
      multicall: '0xb5b692a88BDFc81ca69dcB1d924f59f0413A602a',
      subgraphs: ['https://gateway.thegraph.com/api/6a217817dd87d33db10beed79b044a91/subgraphs/id/F1m8vxuGatCBRvP8fPnnWUJ1oK7kfE1DGdRacqoamLjF', 'https://gateway.thegraph.com/api/8b164501e1862078eff5fb9dda136c6c/subgraphs/id/F1m8vxuGatCBRvP8fPnnWUJ1oK7kfE1DGdRacqoamLjF'],
      defaultRpcs: ['https://endpoints.omniatech.io/v1/gnosis/mainnet/public', 'https://gnosis-mainnet.public.blastapi.io', 'https://gnosis.drpc.org', 'https://gnosis-rpc.publicnode.com', 'https://rpc.gnosis.gateway.fm']
    },
    netId137: {
      tokens: {
        matic: {
          instanceAddress: {
            100: '0x1E34A77868E19A6647b1f2F47B51ed72dEDE95DD',
            1000: '0xdf231d99Ff8b6c6CBF4E9B9a945CBAcEF9339178',
            10000: '0xaf4c0B70B2Ea9FB7487C7CbB37aDa259579fe040',
            100000: '0xa5C2254e4253490C54cef0a4347fddb8f75A4998'
          },
          deployedBlockNumber: {
            100: 16258013,
            1000: 16258032,
            10000: 16258046,
            100000: 16258053
          },
          miningEnabled: false,
          symbol: 'MATIC',
          decimals: 18
        }
      },
      ensSubdomainKey: 'polygon-tornado',
      firstDeploymentTransaction: '0xacc7e3b4a9f0db50e86cc7b6569b8deb0c73539c890dcace9c0ac8308648ef3f',
      proxy: '0x0D5550d52428E7e3175bfc9550207e4ad3859b17',
      multicall: '0x11ce4B23bD875D7F5C6a31084f55fDe1e9A87507',
      subgraphs: ['https://gateway.thegraph.com/api/6a217817dd87d33db10beed79b044a91/subgraphs/id/HUMgwMYNrPQpnBJgesFXyy5u6jSiJ6u5nNWQng9ayCmD', 'https://gateway.thegraph.com/api/8b164501e1862078eff5fb9dda136c6c/subgraphs/id/HUMgwMYNrPQpnBJgesFXyy5u6jSiJ6u5nNWQng9ayCmD', 'https://tornadocash-rpc.com/subgraphs/name/tornadocash/matic-tornado-subgraph'],
      defaultRpcs: ['https://polygon-rpc.com', 'https://polygon-mainnet.chainnodes.org/3ae3d849-a613-4917-a56e-080f181aa4da', 'https://polygon-mainnet.public.blastapi.io', 'https://go.getblock.io/02667b699f05444ab2c64f9bff28f027']
    },
    netId42161: {
      tokens: {
        eth: {
          instanceAddress: {
            0.1: '0x84443CFd09A48AF6eF360C6976C5392aC5023a1F',
            1: '0xd47438C816c9E7f2E2888E060936a499Af9582b3',
            10: '0x330bdFADE01eE9bF63C209Ee33102DD334618e0a',
            100: '0x1E34A77868E19A6647b1f2F47B51ed72dEDE95DD'
          },
          deployedBlockNumber: {
            0.1: 3300000,
            1: 3300000,
            10: 3300000,
            100: 3300000
          },
          miningEnabled: false,
          symbol: 'ETH',
          decimals: 18
        }
      },
      ensSubdomainKey: 'arbitrum-tornado',
      firstDeploymentTransaction: '0xa30c79d199d11ad02336efa60f21aed131e1d29a1e49691e73f5e75b66e833e1',
      proxy: '0x0D5550d52428E7e3175bfc9550207e4ad3859b17',
      multicall: '0xB064Fe785d8131653eE12f3581F9A55F6D6E1ca3',
      subgraphs: ['https://gateway.thegraph.com/api/8b164501e1862078eff5fb9dda136c6c/subgraphs/id/8x8o6XFAqYZmiPwrJ51UxGTaZLYyW1fFtghvsEy7a1KJ', 'https://tornadocash-rpc.com/subgraphs/name/tornadocash/arbitrum-tornado-subgraph'],
      defaultRpcs: ['https://endpoints.omniatech.io/v1/arbitrum/one/public', 'https://arbitrum.blockpi.network/v1/rpc/public', 'https://arbitrum-one.chainnodes.org/3ae3d849-a613-4917-a56e-080f181aa4da', 'https://arbitrum.drpc.org', 'https://arbitrum-one-rpc.publicnode.com']
    },
    netId43114: {
      tokens: {
        avax: {
          instanceAddress: {
            10: '0x330bdFADE01eE9bF63C209Ee33102DD334618e0a',
            100: '0x1E34A77868E19A6647b1f2F47B51ed72dEDE95DD',
            500: '0xaf8d1839c3c67cf571aa74B5c12398d4901147B3'
          },
          deployedBlockNumber: {
            10: 4429830,
            100: 4429851,
            500: 4429837
          },
          miningEnabled: false,
          symbol: 'AVAX',
          decimals: 18
        }
      },
      ensSubdomainKey: 'avalanche-tornado',
      firstDeploymentTransaction: '0x82bd723e79e2520c7170b2edbc420a78e4f77683fe0689bea32c776fba951c86',
      proxy: '0x0D5550d52428E7e3175bfc9550207e4ad3859b17',
      multicall: '0x98e2060F672FD1656a07bc12D7253b5e41bF3876',
      subgraphs: ['https://gateway.thegraph.com/api/8b164501e1862078eff5fb9dda136c6c/subgraphs/id/CqUYVKJT9Jsyt7qnGNrf4FJNHw75ZbFGuzaJgqdaFASo', 'https://gateway.thegraph.com/api/6a217817dd87d33db10beed79b044a91/subgraphs/id/CqUYVKJT9Jsyt7qnGNrf4FJNHw75ZbFGuzaJgqdaFASo', 'https://tornadocash-rpc.com/subgraphs/name/tornadocash/avalanche-tornado-subgraph'],
      defaultRpcs: ['https://endpoints.omniatech.io/v1/avax/mainnet/public', 'https://ava-mainnet.public.blastapi.io/ext/bc/C/rpc', 'https://avalanche.drpc.org', 'https://avalanche-c-chain-rpc.publicnode.com']
    },
    netId10: {
      tokens: {
        eth: {
          instanceAddress: {
            0.1: '0x84443CFd09A48AF6eF360C6976C5392aC5023a1F',
            1: '0xd47438C816c9E7f2E2888E060936a499Af9582b3',
            10: '0x330bdFADE01eE9bF63C209Ee33102DD334618e0a',
            100: '0x1E34A77868E19A6647b1f2F47B51ed72dEDE95DD'
          },
          deployedBlockNumber: {
            0.1: 2243707,
            1: 2243709,
            10: 2243735,
            100: 2243749
          },
          miningEnabled: false,
          symbol: 'ETH',
          decimals: 18
        }
      },
      ensSubdomainKey: 'optimism-tornado',
      firstDeploymentTransaction: '0x51443a56acc45e6ae9e167a90c8896c0d60e7a999818b5e16db93e6d6df76f98',
      proxy: '0x0D5550d52428E7e3175bfc9550207e4ad3859b17',
      multicall: '0x142E2FEaC30d7fc3b61f9EE85FCCad8e560154cc',
      subgraphs: ['https://gateway.thegraph.com/api/6a217817dd87d33db10beed79b044a91/subgraphs/id/GvkbnEVhLD6KArXpEzLFtSKRmspBW29ApKFqR5FjuP2P', 'https://gateway.thegraph.com/api/8b164501e1862078eff5fb9dda136c6c/subgraphs/id/GvkbnEVhLD6KArXpEzLFtSKRmspBW29ApKFqR5FjuP2P', 'https://tornadocash-rpc.com/subgraphs/name/tornadocash/optimism-tornado-subgraph'],
      defaultRpcs: ['https://optimism.blockpi.network/v1/rpc/public', 'https://optimism-mainnet.chainnodes.org/3ae3d849-a613-4917-a56e-080f181aa4da', 'https://endpoints.omniatech.io/v1/op/mainnet/public', 'https://optimism-mainnet.public.blastapi.io', 'https://optimism.drpc.org']
    },
    netId11155111: {
      tokens:
      {
        eth: 
        {
          instanceAddress: 
          {
            0.1: '0x8C4A04d872a6C1BE37964A21ba3a138525dFF50b',
            1: '0x8cc930096B4Df705A007c4A039BDFA1320Ed2508',
            10: '0x8D10d506D29Fc62ABb8A290B99F66dB27Fc43585',
          },
          deployedBlockNumber: 
          {
            0.1: 5594400,
            1: 5594401,
            10: 5594402,
          },
            miningEnabled: false,
            symbol: 'ETH',
            decimals: 18
        } 
      },
      ensSubdomainKey: 'sepolia-tornado',
      firstDeploymentTransaction: '0x7c7260a119bd0682b785da8860def277877ffaa50c2068ee78d6cb51f50bdc1f',
      proxy: '0x1572AFE6949fdF51Cb3E0856216670ae9Ee160Ee',
      multicall: '0x53c43764255c17bd724f74c4ef150724ac50a3ed',
      subgraphs: ['https://gateway.thegraph.com/api/6a217817dd87d33db10beed79b044a91/subgraphs/id/8kJGz92AYUm72wfyUoze1as3E11ynDSTZM8emiRWrRPy',
                  'https://gateway.thegraph.com/api/8b164501e1862078eff5fb9dda136c6c/subgraphs/id/8kJGz92AYUm72wfyUoze1as3E11ynDSTZM8emiRWrRPy',
                  'https://tornadocash-rpc.com/subgraphs/name/tornadocash/sepolia-tornado-subgraph'
      ],
      defaultRpcs: ['https://ethereum-sepolia-rpc.publicnode.com', 
                    'https://sepolia.chainnodes.org/61b7de01-6cc4-40dc-a6c2-b6e4a61bb042',
                    'https://sepolia.drpc.org',
                    'https://eth-sepolia.g.alchemy.com/v2/demo',
                    'https://eth-sepolia.public.blastapi.io',
                    'https://eth-sepolia.api.onfinality.io/public']
      
    },
    netId61:
    {
      tokens: 
      {
        etc:
        {
          instanceAddress: 
          {
            1: '0x2f56d5aFC058B8734350B162EFEe75ee48f034e0',
            10: '0x59fCB629A23e8eD0a60A0188771E221042260118',
            100: '0x784B3a7a7981B959bd8d9D9e73c2013BE819Fbf2',
          },
          deployedBlockNumber: 
          {
            1: 22385618,
            10: 22385618,
            100: 22385618,
          },
          miningEnabled: false,
          symbol: 'ETC',
          decimals: 18
        }
      },
      ensSubdomainKey: 'etc-tornado',
      firstDeploymentTransaction: '0x4d9232046d3503138525bb3b921e131153d02b436f9f81426f52929e50ab359e',
      proxy: '0xac97AB4fBd872ea762974CbBB0Ee72351afe16F3',
      multicall: '0xA52EE88C0F24EF8b96C3989cAb42cfC6008041A8',
      subgraphs: ['https://graph.torndao.com/subgraphs/name/tornadocash/etc-tornado-subgraph'],
      defaultRpcs:  ['https://etc.etcdesktop.com',
                     'https://etc.rivet.link',
                     'https://etc.mytokenpocket.vip',
                     'https://0xrpc.io/etc',
                     'https://geth-at.etc-network.info',
                     'https://besu-at.etc-network.info'],
      
    }
  }
};
