/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const Oracle = artifacts.require('Oracle');
const ResolutionEngine = artifacts.require('ResolutionEngine');

module.exports = async (deployer) => {
    await deployer.deploy(Oracle);
    await deployer.deploy(ResolutionEngine);
};
