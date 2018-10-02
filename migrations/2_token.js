/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const utils = require('./utils.js');

const StakeToken = artifacts.require('StakeToken');

// TODO Update to require deployed verification token (HBT) rather than deploying separate test token

module.exports = async (deployer, network, accounts) => {
    let ownerAccount;

    try {
        ownerAccount = await utils.initializeOwnerAccount(network, accounts);

        await deployer.deploy(StakeToken, {from: ownerAccount});
    } finally {
        await utils.finalizeAccount(ownerAccount);
    }
};
