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
        const oracle = Wallet.createRandom().address;
        testToken = await TestToken.new();

        resolutionEngine = await MockedResolutionEngine.new(oracle, testToken.address);

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

        it('should successfully transfer tokens to bounty fund', async () => {
            const result = await bountyFund.depositTokens(100, {from: accounts[2]});

            result.logs[0].event.should.equal('TokensDeposited');
            (await testToken.balanceOf.call(bountyFund.address)).should.eq.BN(100);
        });
    });

    describe('withdrawTokens()', () => {
        let partsPer;

        before(async () => {
            partsPer = await bountyFund.PARTS_PER.call();
        });

        describe('if done by agent not registered as resolution engine', () => {
            it('should revert', async () => {
                bountyFund.withdrawTokens(partsPer).should.be.rejected;
            });
        });

        describe('if done by registered resolution engine', () => {
            let fraction;

            before(async () => {
                await testToken.mint(bountyFund.address, 100);
            });

            describe('if fraction is too large', () => {
                before(async () => {
                    fraction = partsPer.muln(2);
                });

                it('should revert', async () => {
                    resolutionEngine._withdrawTokens(fraction).should.be.rejected;
                });
            });

            describe('if fraction is within bounds', () => {
                let balanceBefore;

                before(async () => {
                    balanceBefore = await testToken.balanceOf(bountyFund.address);
                    fraction = partsPer.divn(2);
                });

                it('should successfully transfer tokens to bounty fund', async () => {
                    await resolutionEngine._withdrawTokens(fraction);

                    (await testToken.balanceOf.call(resolutionEngine.address)).should.eq.BN(balanceBefore.mul(fraction).div(partsPer));
                });
            });
        });
    });
});
