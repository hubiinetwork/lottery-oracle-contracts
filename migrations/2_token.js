/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const utils = require('./utils.js');

const StakeToken = artifacts.require('StakeToken');

module.exports = async (deployer, network, accounts) => {
    if ('mainnet' === network)
        return;

    let ownerAccount;
    try {
        ownerAccount = await utils.initializeOwnerAccount(network, accounts);

        await deployer.deploy(StakeToken, 'hubiit', 'HBT', 15, {from: ownerAccount});
    } finally {
        await utils.finalizeAccount(ownerAccount);
    }
};
