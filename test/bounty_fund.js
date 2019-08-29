/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const {Wallet, constants} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const BountyFund = artifacts.require('BountyFund');
const StakeToken = artifacts.require('StakeToken');
const MockedResolutionEngine = artifacts.require('MockedResolutionEngine');

contract('BountyFund', (accounts) => {
    let stakeToken, bountyFund;

    beforeEach(async () => {
        stakeToken = await StakeToken.new('hubiit', 'HBT', 15);

        bountyFund = await BountyFund.new(stakeToken.address);
    });

    describe('constructor()', () => {
        it('initialize successfully', async () => {
            bountyFund.address.should.have.lengthOf(42);

            const ownerRole = await bountyFund.OWNER_ROLE();
            (await bountyFund.isRoleAccessor(ownerRole, accounts[0])).should.be.true;
            (await bountyFund.isRoleAccessor(ownerRole, accounts[1])).should.be.false;
        });
    });

    describe('token()', () => {
        it('should equal the value passed as constructor argument', async () => {
            (await bountyFund.token()).should.equal(stakeToken.address);
        });
    });

    describe('setResolutionEngine()', () => {
        let resolutionEngine;

        describe('when called with zero address', () => {
            it('should revert', async () => {
                bountyFund.setResolutionEngine(constants.AddressZero).should.be.rejected;
            });
        });

        describe('when called the first time', () => {
            beforeEach(() => {
                resolutionEngine = Wallet.createRandom().address;
            });

            it('should successfully set the resolution engine', async () => {
                const result = await bountyFund.setResolutionEngine(resolutionEngine);

                result.logs[0].event.should.equal('ResolutionEngineSet');
                (await bountyFund.resolutionEngine()).should.equal(resolutionEngine);
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
            (await stakeToken.balanceOf(bountyFund.address)).should.eq.BN(100);
        });
    });

    describe('withdrawTokens()', () => {
        let partsPer;

        beforeEach(async () => {
            partsPer = await bountyFund.PARTS_PER();
        });

        describe('if done by agent not registered as resolution engine', () => {
            it('should revert', async () => {
                bountyFund.withdrawTokens(partsPer.divn(10)).should.be.rejected;
            });
        });

        describe('if done by registered resolution engine', () => {
            let resolutionEngine;

            beforeEach(async () => {
                await stakeToken.mint(bountyFund.address, 100);

                resolutionEngine = await MockedResolutionEngine.new(
                    Wallet.createRandom().address, bountyFund.address, 0
                );
            });

            describe('if bounty fraction is too large', () => {
                it('should revert', async () => {
                    resolutionEngine._withdrawTokens(partsPer.muln(2)).should.be.rejected;
                });
            });

            describe('if bounty fraction is within bounds', () => {
                let balanceBefore, bountyFraction;

                beforeEach(async () => {
                    balanceBefore = await stakeToken.balanceOf(bountyFund.address);

                    bountyFraction = partsPer.divn(2);
                });

                it('should successfully transfer tokens to bounty fund', async () => {
                    await resolutionEngine._withdrawTokens(bountyFraction);

                    (await stakeToken.balanceOf(resolutionEngine.address))
                        .should.eq.BN(balanceBefore.mul(bountyFraction).div(partsPer));
                });
            });
        });
    });
});
