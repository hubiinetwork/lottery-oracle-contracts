/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

const utils = require('../script/common/utils.js');

// Using './Contract.sol' rather than 'Contract' because of https://github.com/trufflesuite/truffle/issues/611
const StakeToken = artifacts.require('./StakeToken');

module.exports = async (deployer, network, accounts) => {
    if ('mainnet' === network)
        return;

    let ownerAccount = await utils.initializeOwnerAccount(web3, network, accounts);

    await deployer.deploy(StakeToken, 'hubiit', 'HBT', 15, {from: ownerAccount});
};
