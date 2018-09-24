/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const {Wallet} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const BountyFund = artifacts.require('BountyFund');
// const MockedResolutionEngine = artifacts.require('MockedResolutionEngine');

contract('BountyFund', (accounts) => {
    let bountyFund;

    beforeEach(async () => {
        bountyFund = await BountyFund.deployed();
    });

    describe('constructor()', () => {
        it('should test successfully', async () => {
            bountyFund.address.should.have.lengthOf(42);
            const ownerRole = await bountyFund.OWNER_ROLE.call();
            (await bountyFund.isRoleAccessor.call(ownerRole, accounts[0])).should.be.true;
            (await bountyFund.isRoleAccessor.call(ownerRole, accounts[1])).should.not.be.true;
        });
    });
});
