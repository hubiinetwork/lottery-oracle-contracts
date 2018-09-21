const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const {Wallet} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const Oracle = artifacts.require('Oracle');

contract('Oracle', (accounts) => {
    let oracle;

    beforeEach(async () => {
        oracle = await Oracle.deployed();
    });

    describe('constructor()', () => {
        it('should test successfully', async () => {
            oracle.address.should.have.lengthOf(42);
            const ownerRole = await oracle.OWNER_ROLE.call();
            (await oracle.isRoleAccessor.call(ownerRole, accounts[0])).should.be.true;
            (await oracle.isRoleAccessor.call(ownerRole, accounts[1])).should.not.be.true;
        });
    });

    describe('hasResolutionEngine()', () => {
        it('should test successfully', async () => {
            (await oracle.hasResolutionEngine.call(Wallet.createRandom().address)).should.be.false;
        });
    });

    describe('addResolutionEngine()', () => {
        let engineAddress;

        beforeEach(() => {
            engineAddress = Wallet.createRandom().address;
        });

        describe('if called by non-owner', () => {
            it('should revert', async () => {
                oracle.addResolutionEngine(engineAddress, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by owner', () => {
            it('should test successfully', async () => {
                const result = await oracle.addResolutionEngine(engineAddress);
                result.logs[0].event.should.equal('ResolutionEngineAdded');
                (await oracle.hasResolutionEngine.call(engineAddress)).should.be.true;
            });
        });
    });

    describe('removeResolutionEngine()', () => {
        let engineAddress;

        beforeEach(() => {
            engineAddress = Wallet.createRandom().address;
        });

        describe('if called by non-owner', () => {
            it('should revert', async () => {
                oracle.removeResolutionEngine(engineAddress, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by owner', () => {
            beforeEach(async () => {
                await oracle.addResolutionEngine(engineAddress);
            });

            it('should test successfully', async () => {
                const result = await oracle.removeResolutionEngine(engineAddress);
                result.logs[0].event.should.equal('ResolutionEngineRemoved');
                (await oracle.hasResolutionEngine.call(engineAddress)).should.be.false;
            });
        });
    });
});
