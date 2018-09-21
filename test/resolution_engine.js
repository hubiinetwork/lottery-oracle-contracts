const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BN = require('bn.js');
const bnChai = require('bn-chai');
// const {Wallet} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const ResolutionEngine = artifacts.require('ResolutionEngine');

contract('ResolutionEngine', (accounts) => {
    let resolutionEngine;

    beforeEach(async () => {
        resolutionEngine = await ResolutionEngine.deployed();
    });

    describe('constructor()', () => {
        it('should test successfully', async () => {
            resolutionEngine.address.should.have.lengthOf(42);
            (await resolutionEngine.isOwner.call(accounts[0])).should.be.true;
            (await resolutionEngine.isOwner.call(accounts[1])).should.not.be.true;
        });
    });
});
