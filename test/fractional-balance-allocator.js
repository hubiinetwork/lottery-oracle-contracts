/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const {Wallet, utils, constants: {AddressZero}} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const FractionalBalanceAllocator = artifacts.require('FractionalBalanceAllocator');
const StakeToken = artifacts.require('StakeToken');
const MockedBountyFund = artifacts.require('MockedBountyFund');

contract('FractionalBalanceAllocator', (accounts) => {
    let allocator, stakeToken, bountyFund;

    beforeEach(async () => {
        stakeToken = await StakeToken.new('hubiit', 'HBT', 15);

        bountyFund = await MockedBountyFund.new();
        await bountyFund._setToken(stakeToken.address);

        stakeToken.mint(stakeToken.address, 100);

        allocator = await FractionalBalanceAllocator.new(
            bountyFund.address, new BN('1e17')
        );
    });

    describe('constructor()', () => {
        it('initialize successfully', async () => {
            allocator.address.should.have.lengthOf(42);

            (await allocator.bountyFund()).should.equal(bountyFund.address);
            (await allocator.fraction()).should.eq.BN(new BN('1e17'));
            (await allocator.token()).should.equal(stakeToken.address);
        });
    });

    describe('allocate()', () => {
        it('should return the fractional amount of tokens owned by the bounty fund', async () => {
            (await allocator.allocate()).should.eq.BN(
                (await stakeToken.balanceOf(bountyFund.address)).divn(10)
            );
        });
    });
});
