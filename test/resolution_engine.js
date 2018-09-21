const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const {Wallet} = require('ethers');

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

    describe('isSetOracle()', () => {
        it('should test successfully', async () => {
            (await resolutionEngine.isSetOracle.call(Wallet.createRandom().address)).should.be.false;
        });
    });

    describe('setOracle()', () => {
        let oracleAddress;

        beforeEach(() => {
            oracleAddress = Wallet.createRandom().address;
        });

        describe('if called by non-owner', () => {
            it('should revert', async () => {
                resolutionEngine.setOracle(oracleAddress, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by owner', () => {
            it('should test successfully', async () => {
                const result = await resolutionEngine.setOracle(oracleAddress);
                result.logs[0].event.should.equal('OracleSet');
                (await resolutionEngine.isSetOracle.call(oracleAddress)).should.be.true;
            });
        });
    });
});
