module.exports = {
    // See <http://truffleframework.com/docs/advanced/configuration>
    // to customize your Truffle configuration!
    networks: {
        development: {
            host: 'localhost',
            port: 8545,
            network_id: '*',
            gas: 6000000
        },
        develop: {
            host: "localhost",
            port: 9545,
            network_id: "*",
            gas: 6000000
        },
        ropsten: {
            host: 'geth-ropsten.ethereum',
            port: 80,
            network_id: '3',
            gas: 6000000
        },
        mainnet: {
            host: 'ethereum.hubii.com',
            port: 8545,
            network_id: '1',
            gas: 6000000
        }
    },
    compilers: {
        solc: {
            version: process.env.SOLC_VERSION || '0.4.25', // Assuming >= 0.4.25 in contract pragmas
            docker: typeof process.env.SOLC_DOCKER === 'undefined' ? false : Boolean(process.env.SOLC_DOCKER)
        }
    },
    mocha: {
        reporter: process.env.MOCHA_REPORTER || 'spec'
    }
};
