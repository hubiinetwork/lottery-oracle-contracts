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
const TestToken = artifacts.require('TestToken');
const MockedResolutionEngine = artifacts.require('MockedResolutionEngine');

contract('BountyFund', (accounts) => {
    let testToken, bountyFund, resolutionEngine;

    before(async () => {
        testToken = await TestToken.new();
        resolutionEngine = await MockedResolutionEngine.new();
        await resolutionEngine.setToken(testToken.address);
        bountyFund = await BountyFund.new(resolutionEngine.address);
    });

    describe('constructor()', () => {
        it('initialize successfully', async () => {
            bountyFund.address.should.have.lengthOf(42);
            const ownerRole = await bountyFund.OWNER_ROLE.call();
            (await bountyFund.isRoleAccessor.call(ownerRole, accounts[0])).should.be.true;
            (await bountyFund.isRoleAccessor.call(ownerRole, accounts[1])).should.be.false;
        });
    });

    describe('resolutionEngine()', () => {
        it('should equal the value passed as constructor argument', async () => {
            (await bountyFund.resolutionEngine.call()).should.equal(resolutionEngine.address);
        });
    });

    describe('token()', () => {
        it('should equal the value returned by resolution engine\'s token() function', async () => {
            (await bountyFund.token.call()).should.equal(await resolutionEngine.token.call());
        });
    });

    describe('depositTokens()', () => {
        before(async () => {
            await testToken.mint(accounts[2], 100);
            await testToken.approve(bountyFund.address, 100, {from: accounts[2]});
        });

        it('successfully transfer tokens to bounty fund', async () => {
            const result = await bountyFund.depositTokens(100, {from: accounts[2]});
            result.logs[0].event.should.equal('TokensDeposited');
            (await testToken.balanceOf.call(bountyFund.address)).should.eq.BN(100);
        });
    });
});
