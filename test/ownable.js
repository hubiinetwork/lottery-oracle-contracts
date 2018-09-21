const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const {Wallet} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const Ownable = artifacts.require('TestOwnable');

contract('Ownable', (accounts) => {
    let ownable;

    beforeEach(async () => {
        ownable = await Ownable.new();
    });

    describe('isOwner()', () => {
        it('should test successfully', async () => {
            (await ownable.isOwner.call(accounts[0])).should.be.true;
            (await ownable.isOwner.call(accounts[1])).should.be.false;
        });
    });

    describe('addOwner()', () => {
        let ownerAddress;

        beforeEach(() => {
            ownerAddress = Wallet.createRandom().address;
        });

        describe('if called by non-owner', () => {
            it('should revert', async () => {
                ownable.addOwner(ownerAddress, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by owner', () => {
            it('should test successfully', async () => {
                const result = await ownable.addOwner(ownerAddress, {from: accounts[0]});
                result.logs[0].event.should.equal('OwnerAdded');
                (await ownable.isOwner.call(ownerAddress)).should.be.true;
            });
        });
    });

    describe('removeOwner()', () => {
        let ownerAddress;

        beforeEach(() => {
            ownerAddress = Wallet.createRandom().address;
        });

        describe('if called by non-owner', () => {
            it('should revert', async () => {
                ownable.removeOwner(ownerAddress, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by owner', () => {
            beforeEach(async () => {
                await ownable.addOwner(ownerAddress, {from: accounts[0]});
            });

            it('should test successfully', async () => {
                const result = await ownable.removeOwner(ownerAddress, {from: accounts[0]});
                result.logs[0].event.should.equal('OwnerRemoved');
                (await ownable.isOwner.call(ownerAddress)).should.be.false;
            });
        });
    });
});
