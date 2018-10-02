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

const Oracle = artifacts.require('Oracle');
const BountyFund = artifacts.require('BountyFund');
const StakeToken = artifacts.require('StakeToken');
const MockedResolutionEngine = artifacts.require('MockedResolutionEngine');

contract('Oracle', (accounts) => {
    let oracle, stakeToken;

    beforeEach(async () => {
        oracle = await Oracle.new();
        stakeToken = await StakeToken.new('hubiit', 'HBT', 15);
    });

    describe('constructor()', () => {
        it('should successfully initialize', async () => {
            oracle.address.should.have.lengthOf(42);
            const ownerRole = await oracle.OWNER_ROLE.call();
            (await oracle.isRoleAccessor.call(ownerRole, accounts[0])).should.be.true;
            (await oracle.isRoleAccessor.call(ownerRole, accounts[1])).should.be.false;
        });
    });

    describe('hasResolutionEngine()', () => {
        it('should successfully return initial value', async () => {
            (await oracle.hasResolutionEngine.call(Wallet.createRandom().address)).should.be.false;
        });
    });

    describe('resolutionEnginesCount()', () => {
        it('should successfully return initial value', async () => {
            (await oracle.resolutionEnginesCount.call()).should.eq.BN(0);
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
            it('should successfully add resolution engine', async () => {
                const result = await oracle.addResolutionEngine(engineAddress);
                result.logs[0].event.should.equal('ResolutionEngineAdded');
                (await oracle.hasResolutionEngine.call(engineAddress)).should.be.true;
                (await oracle.resolutionEnginesCount.call()).should.eq.BN(1);
            });
        });
    });

    describe('removeResolutionEngine()', () => {
        let engineAddress1;

        beforeEach(() => {
            engineAddress1 = Wallet.createRandom().address;
        });

        describe('if called by non-owner', () => {
            it('should revert', async () => {
                oracle.removeResolutionEngine(engineAddress1, {from: accounts[1]}).should.be.rejected;
            });
        });

        describe('if called by owner', () => {
            let resolutionEnginesCount;

            describe('if removing the last address stored', () => {
                beforeEach(async () => {
                    await oracle.addResolutionEngine(engineAddress1);
                    resolutionEnginesCount = await oracle.resolutionEnginesCount.call();
                });

                it('should successfully remove resolution engine', async () => {
                    const result = await oracle.removeResolutionEngine(engineAddress1);
                    result.logs[0].event.should.equal('ResolutionEngineRemoved');
                    (await oracle.hasResolutionEngine.call(engineAddress1)).should.be.false;
                    (await oracle.resolutionEnginesCount.call()).should.eq.BN(resolutionEnginesCount.subn(1));
                });
            });

            describe('if removing not the last address stored', () => {
                let engineAddress2;

                beforeEach(async () => {
                    engineAddress2 = Wallet.createRandom().address;

                    await oracle.addResolutionEngine(engineAddress1);
                    await oracle.addResolutionEngine(engineAddress2);
                    resolutionEnginesCount = await oracle.resolutionEnginesCount.call();
                });

                it('should successfully remove resolution engine', async () => {
                    const result = await oracle.removeResolutionEngine(engineAddress1);
                    result.logs[0].event.should.equal('ResolutionEngineRemoved');
                    (await oracle.hasResolutionEngine.call(engineAddress1)).should.be.false;
                    (await oracle.resolutionEnginesCount.call()).should.eq.BN(resolutionEnginesCount.subn(1));
                });
            });
        });
    });

    describe('stakeTokens()', () => {
        describe('if called on non-registered resolution engine', () => {
            let resolutionEngine;

            beforeEach(() => {
                resolutionEngine = Wallet.createRandom().address;
            });

            it('should revert', async () => {
                oracle.stakeTokens(resolutionEngine, 0, true, 100).should.be.rejected;
            });
        });

        describe('if called on registered resolution engine', () => {
            let mockedResolutionEngine, balanceBefore;

            beforeEach(async () => {
                oracle = await Oracle.new();

                const bountyFund = await BountyFund.new(stakeToken.address);
                stakeToken.mint(bountyFund.address, 100);

                const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
                mockedResolutionEngine = await MockedResolutionEngine.new(oracle.address, bountyFund.address, bountyFraction);

                await oracle.addResolutionEngine(mockedResolutionEngine.address);

                await stakeToken.mint(accounts[1], 100);
                await stakeToken.approve(oracle.address, 100, {from: accounts[1]});

                balanceBefore = await stakeToken.balanceOf.call(accounts[1]);
            });

            it('should successfully stake tokens', async () => {
                const result = await oracle.stakeTokens(mockedResolutionEngine.address, 0, true, 100, {from: accounts[1]});

                result.logs[0].event.should.equal('TokensStaked');

                (await stakeToken.balanceOf.call(accounts[1])).should.eq.BN(balanceBefore.subn(100));
            });
        });
    });

    describe('claimPayout()', () => {
        let mockedResolutionEngine;

        beforeEach(async () => {
            oracle = await Oracle.new();

            const bountyFund = await BountyFund.new(stakeToken.address);
            stakeToken.mint(bountyFund.address, 100);

            const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
            mockedResolutionEngine = await MockedResolutionEngine.new(oracle.address, bountyFund.address, bountyFraction);

            await oracle.addResolutionEngine(mockedResolutionEngine.address);
        });

        it('should successfully claim payout', async () => {
            const result = await oracle.claimPayout(mockedResolutionEngine.address, 0, 10, {from: accounts[1]});

            result.logs[0].event.should.equal('PayoutClaimed');
        });
    });
});
