const Oracle = artifacts.require('Oracle');
const ResolutionEngine = artifacts.require('ResolutionEngine');

module.exports = (deployer) => {
    deployer.deploy(Oracle);
    deployer.deploy(ResolutionEngine);
};
