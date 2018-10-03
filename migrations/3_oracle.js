/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const utils = require('./utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const Oracle = artifacts.require('./Oracle.sol');

// TODO Update to require deployed verification token (HBT) rather than deploying separate test token

module.exports = async (deployer, network, accounts) => {
    let ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

    await deployer.deploy(Oracle, {from: ownerAccount});
};
