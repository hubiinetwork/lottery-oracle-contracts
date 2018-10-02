/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const utils = require('./utils.js');

const Migrations = artifacts.require('Migrations');

module.exports = async (deployer, network, accounts) => {
    let ownerAccount;
    try {
        ownerAccount = await utils.initializeOwnerAccount(network, accounts);

        await deployer.deploy(Migrations, {from: ownerAccount, overwrite: false});
    } finally {
        await utils.finalizeAccount(ownerAccount);
    }
};
