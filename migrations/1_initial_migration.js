/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const utils = require('./utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const Migrations = artifacts.require('./Migrations.sol');

module.exports = async (deployer, network, accounts) => {
    let ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

    await deployer.deploy(Migrations, {from: ownerAccount});
};

