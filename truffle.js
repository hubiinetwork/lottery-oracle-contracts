module.exports = {
    // See <http://truffleframework.com/docs/advanced/configuration>
    // to customize your Truffle configuration!
    compilers: {
        solc: {
            version: process.env.SOLC_VERSION || '0.4.25',
            docker: process.env.SOLC_DOCKER == undefined ? false : Boolean(process.env.SOLC_DOCKER)
        }
    },
    mocha: {
        reporter: process.env.MOCHA_REPORTER || 'spec'
    }
};
