/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */


const Oracle = artifacts.require('Oracle');
const ResolutionEngine = artifacts.require('ResolutionEngine');
const BountyFund = artifacts.require('BountyFund');

const {Wallet} = require('ethers');

module.exports = async (deployer) => {
    await deployer.deploy(Oracle);
    await deployer.deploy(ResolutionEngine, Oracle.address, Wallet.createRandom().address);
    await deployer.deploy(BountyFund, ResolutionEngine.address);
};
