/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const utils = require('./utils.js');

const Migrations = artifacts.require('Migrations');

//    npm run deploy:ci -- --network hubii-ropsten --wallet %eth.testnet.account% --password "%eth.testnet.secret%"

module.exports = async (deployer, network, accounts) => {
    let ownerAccount;

    try {
        ownerAccount = await utils.initializeOwnerAccount(network, accounts);

        await deployer.deploy(Migrations, {from: ownerAccount});
    } finally {
        await utils.finalizeAccount(ownerAccount);
    }
};
