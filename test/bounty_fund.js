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
const StakeToken = artifacts.require('StakeToken');
const MockedResolutionEngine = artifacts.require('MockedResolutionEngine');

const zeroAddress = '0x0000000000000000000000000000000000000000';

contract('BountyFund', (accounts) => {
    let stakeToken, bountyFund, resolutionEngine;

    beforeEach(async () => {
        stakeToken = await StakeToken.new('hubiit', 'HBT', 15);

        bountyFund = await BountyFund.new(stakeToken.address);
    });

    describe('constructor()', () => {
        it('initialize successfully', async () => {
            bountyFund.address.should.have.lengthOf(42);

            const ownerRole = await bountyFund.OWNER_ROLE.call();
            (await bountyFund.isRoleAccessor.call(ownerRole, accounts[0])).should.be.true;
            (await bountyFund.isRoleAccessor.call(ownerRole, accounts[1])).should.be.false;
        });
    });

    describe('token()', () => {
        it('should equal the value passed as constructor argument', async () => {
            (await bountyFund.token.call()).should.equal(stakeToken.address);
        });
    });

    describe('setResolutionEngine()', () => {
        let resolutionEngine;

        describe('when called with zero address', () => {
            it('should revert', async () => {
                bountyFund.setResolutionEngine(zeroAddress).should.be.rejected;
            });
        });

        describe('when called the first time', () => {
            beforeEach(() => {
                resolutionEngine = Wallet.createRandom().address;
            });

            it('should successfully set the resolution engine', async () => {
                const result = await bountyFund.setResolutionEngine(resolutionEngine);

                result.logs[0].event.should.equal('ResolutionEngineSet');
                (await bountyFund.resolutionEngine.call()).should.equal(resolutionEngine);
            });
        });

        describe('when called the second time', () => {
            beforeEach(async () => {
                resolutionEngine = Wallet.createRandom().address;
                await bountyFund.setResolutionEngine(resolutionEngine);
            });

            it('should revert', async () => {
                bountyFund.setResolutionEngine(resolutionEngine).should.be.rejected;
            });
        });
    });

    describe('depositTokens()', () => {
        beforeEach(async () => {
            await stakeToken.mint(accounts[2], 100);
            await stakeToken.approve(bountyFund.address, 100, {from: accounts[2]});
        });

        it('should successfully transfer tokens to bounty fund', async () => {
            const result = await bountyFund.depositTokens(100, {from: accounts[2]});

            result.logs[0].event.should.equal('TokensDeposited');
            (await stakeToken.balanceOf.call(bountyFund.address)).should.eq.BN(100);
        });
    });

    describe('withdrawTokens()', () => {
        let partsPer;

        beforeEach(async () => {
            partsPer = await bountyFund.PARTS_PER.call();
        });

        describe('if done by agent not registered as resolution engine', () => {
            it('should revert', async () => {
                bountyFund.withdrawTokens(partsPer).should.be.rejected;
            });
        });

        describe('if done by registered resolution engine', () => {
            let resolutionEngine, fraction;

            beforeEach(async () => {
                await stakeToken.mint(bountyFund.address, 100);

                const oracle = Wallet.createRandom().address;
                resolutionEngine = await MockedResolutionEngine.new(oracle, bountyFund.address, 0.1);
            });

            describe('if fraction is too large', () => {
                beforeEach(async () => {
                    fraction = partsPer.muln(2);
                });

                it('should revert', async () => {
                    resolutionEngine._withdrawTokens(fraction).should.be.rejected;
                });
            });

            describe('if fraction is within bounds', () => {
                let balanceBefore;

                beforeEach(async () => {
                    balanceBefore = await stakeToken.balanceOf.call(bountyFund.address);
                    fraction = partsPer.divn(2);
                });

                it('should successfully transfer tokens to bounty fund', async () => {
                    await resolutionEngine._withdrawTokens(fraction);

                    (await stakeToken.balanceOf.call(resolutionEngine.address)).should.eq.BN(balanceBefore.mul(fraction).div(partsPer));
                });
            });
        });
    });
});
