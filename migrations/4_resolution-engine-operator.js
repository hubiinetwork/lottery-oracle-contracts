/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const utils = require('../script/common/utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const ResolutionEngineOperator = artifacts.require('./ResolutionEngineOperator.sol');

module.exports = async (deployer, network, accounts) => {
    let ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

    await deployer.deploy(ResolutionEngineOperator, 30 * 24 * 60 * 60, {from: ownerAccount}); // 30 day minimum timeout
};
