'use strict';

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
      gas: 8000000,
      websockets: true // To take advantage of the confirmations listener and to hear Events using .on or .once
    },
    develop: {
      host: 'localhost',
      port: 9545,
      network_id: '*',
      gas: 8000000,
      websockets: true
    },
    ganache: {
      host: 'localhost',
      port: 7545,
      network_id: '*',
      gas: 8000000,
      websockets: true
    },
    ropsten: {
      host: 'geth-ropsten.ethereum',
      port: 80,
      network_id: '3',
      gas: 8000000,
      skipDryRun: true, // default: false for public nets
      gasPrice: 40000000000 // default: 20 gwei
      // confirmations: 2,       // default: 0
      // timeoutBlocks: 200,     // minimum/default: 50
    },
    mainnet: {
      host: 'geth-homestead.ethereum',
      port: 80,
      network_id: '1',
      gas: 8000000,
      skipDryRun: true // default: false for public nets
      // gasPrice: 40000000000  // default: 20 gwei
      // confirmations: 2,       // default: 0
      // timeoutBlocks: 200,     // minimum/default: 50
    }
  },
  compilers: {
    solc: {
      version: process.env.SOLC_VERSION || '0.5.11', // Assuming ^0.5.11 in contract pragmas
      docker: typeof process.env.SOLC_DOCKER === 'undefined' ? false : Boolean(process.env.SOLC_DOCKER)
    }
  },
  mocha: {
    reporter: process.env.MOCHA_REPORTER || 'spec'
  }
};
