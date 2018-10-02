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
const ResolutionEngine = artifacts.require('ResolutionEngine');
const BountyFund = artifacts.require('BountyFund');
const MockedResolutionEngine = artifacts.require('MockedResolutionEngine');
const StakeToken = artifacts.require('StakeToken');

contract('ResolutionEngine', (accounts) => {
    let oracleAddress, stakeToken, resolutionEngine, ownerRole, oracleRole, bountyFund;

    beforeEach(async () => {
        oracleAddress = accounts[1];
        stakeToken = await StakeToken.new('hubiit', 'HBT', 15);

        bountyFund = await BountyFund.new(stakeToken.address);
        await stakeToken.mint(bountyFund.address, 100);

        const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
        resolutionEngine = await ResolutionEngine.new(oracleAddress, bountyFund.address, bountyFraction);

        ownerRole = await resolutionEngine.OWNER_ROLE.call();
        oracleRole = await resolutionEngine.ORACLE_ROLE.call();
    });

    describe('constructor()', () => {
        it('should successfully initialize', async () => {
            resolutionEngine.address.should.have.lengthOf(42);
            (await resolutionEngine.isRoleAccessor.call(ownerRole, accounts[0])).should.be.true;
            (await resolutionEngine.isRoleAccessor.call(ownerRole, accounts[1])).should.be.false;
            (await resolutionEngine.isRoleAccessor.call(oracleRole, accounts[0])).should.be.false;
            (await resolutionEngine.isRoleAccessor.call(oracleRole, accounts[1])).should.be.true;
        });
    });

    describe('updateMetrics()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.updateMetrics(accounts[2], 0, true, 100, {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called on non-current verification phase number', () => {
            it('should revert', async () => {
                resolutionEngine.updateMetrics(accounts[2], 1, true, 100, {from: oracleAddress}).should.be.rejected;
            });
        });

        describe('if called by oracle', () => {
            it('should successfully update metrics', async () => {
                const result = await resolutionEngine.updateMetrics(accounts[2], 0, true, 100, {from: oracleAddress});
                result.logs[0].event.should.equal('MetricsUpdated');
            });
        });
    });

    describe('resolveConditionally()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.resolveConditionally(0, {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called by oracle', () => {
            it('should successfully complete', async () => {
                const result = await resolutionEngine.resolveConditionally(0, {from: oracleAddress});

                result.logs[0].event.should.equal('ConditionallyResolved');
            });
        });
    });

    describe('metricsByVerificationPhaseNumber()', () => {
        describe('if verification phase number is too large', () => {
            it('should revert', async () => {
                resolutionEngine.metricsByVerificationPhaseNumber.call(1).should.be.rejected;
            });
        });

        describe('if verification phase number is within bounds', () => {
            it('should return metrics of verification phase number', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumber.call(0);

                result.state.should.exist.and.eq.BN(1);
                result.trueStakeAmount.should.exist.and.eq.BN(0);
                result.falseStakeAmount.should.exist.and.eq.BN(0);
                result.stakeAmount.should.exist.and.eq.BN(0);
                result.numberOfWallets.should.exist.and.eq.BN(0);
                result.bountyAmount.should.exist.and.be.eq.BN(10);
                result.bountyAwarded.should.exist.and.be.false;
                result.startBlock.should.exist.and.be.gt.BN(0);
                result.endBlock.should.exist.and.eq.BN(0);
                result.numberOfBlocks.should.exist.and.be.gt.BN(0);
            });
        });
    });

    describe('metricsByVerificationPhaseNumberAndWallet()', () => {
        describe('if verification phase number is too large', () => {
            it('should revert', async () => {
                resolutionEngine.metricsByVerificationPhaseNumberAndWallet.call(1, Wallet.createRandom().address).should.be.rejected;
            });
        });

        describe('if verification phase number is within bounds', () => {
            it('should return metrics of verification phase number and wallet', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumberAndWallet.call(0, Wallet.createRandom().address);

                result.trueStakeAmount.should.exist.and.eq.BN(0);
                result.falseStakeAmount.should.exist.and.eq.BN(0);
                result.stakeAmount.should.exist.and.eq.BN(0);
            });
        });
    });

    describe('metricsByWallet()', () => {
        it('should return metrics of wallet', async () => {
            const result = await resolutionEngine.metricsByWallet.call(Wallet.createRandom().address);

            result.trueStakeAmount.should.exist.and.eq.BN(0);
            result.falseStakeAmount.should.exist.and.eq.BN(0);
            result.stakeAmount.should.exist.and.eq.BN(0);
        });
    });

    describe('metricsByBlockNumber()', () => {
        describe('if block number is too large', () => {
            let blockNumber;

            beforeEach(async () => {
                blockNumber = await web3.eth.getBlockNumber();
            });

            it('should revert', async () => {
                resolutionEngine.metricsByBlockNumber.call(blockNumber * 2).should.be.rejected;
            });
        });

        describe('if block number is within bounds', () => {
            it('should return metrics of block number', async () => {
                const result = await resolutionEngine.metricsByBlockNumber.call(0);

                result.trueStakeAmount.should.exist.and.eq.BN(0);
                result.falseStakeAmount.should.exist.and.eq.BN(0);
                result.stakeAmount.should.exist.and.eq.BN(0);
            });
        });
    });

    describe('calculatePayout()', () => {
        describe('if resolution result is null-status', () => {
            it('should return 0', async () => {
                const payout = await resolutionEngine.calculatePayout.call(0, Wallet.createRandom().address);

                payout.should.eq.BN(0);
            });
        });

        // 1st scenario in https://docs.google.com/document/d/1o_8BCMLXMNzEJ4uovZdeYUkEmRJPktf_fi55jylJ24w/edit#heading=h.e522u33ktgp6
        describe('if bounty was not awarded', () => {
            let mockedResolutionEngine;

            beforeEach(async () => {
                const oracle = await Oracle.new();

                bountyFund = await BountyFund.new(stakeToken.address);
                await stakeToken.mint(bountyFund.address, 1000);

                const bountyFraction = await bountyFund.PARTS_PER.call();
                mockedResolutionEngine = await MockedResolutionEngine.new(oracle.address, bountyFund.address, bountyFraction);
                await mockedResolutionEngine._setVerificationStatus(1);
                await oracle.addResolutionEngine(mockedResolutionEngine.address);

                await stakeToken.mint(accounts[2], 10);
                await stakeToken.approve(oracle.address, 10, {from: accounts[2]});
                await oracle.stakeTokens(mockedResolutionEngine.address, 0, true, 10, {from: accounts[2]});

                await stakeToken.mint(accounts[3], 90);
                await stakeToken.approve(oracle.address, 90, {from: accounts[3]});
                await oracle.stakeTokens(mockedResolutionEngine.address, 0, true, 90, {from: accounts[3]});

                await stakeToken.mint(accounts[4], 50);
                await stakeToken.approve(oracle.address, 50, {from: accounts[4]});
                await oracle.stakeTokens(mockedResolutionEngine.address, 0, false, 50, {from: accounts[4]});

                await mockedResolutionEngine._closeVerificationPhase();
            });

            it('should return 0', async () => {
                const payout = await mockedResolutionEngine.calculatePayout.call(0, accounts[2]);

                payout.should.eq.BN(15); // Including 10 tokens staked
            });
        });

        // 2nd scenario in https://docs.google.com/document/d/1o_8BCMLXMNzEJ4uovZdeYUkEmRJPktf_fi55jylJ24w/edit#heading=h.e522u33ktgp6
        describe('if bounty was awarded', () => {
            let mockedResolutionEngine;

            beforeEach(async () => {
                const oracle = await Oracle.new();

                bountyFund = await BountyFund.new(stakeToken.address);
                await stakeToken.mint(bountyFund.address, 1000);

                const bountyFraction = await bountyFund.PARTS_PER.call();
                mockedResolutionEngine = await MockedResolutionEngine.new(oracle.address, bountyFund.address, bountyFraction);
                await mockedResolutionEngine._setVerificationStatus(1);
                await oracle.addResolutionEngine(mockedResolutionEngine.address);

                await stakeToken.mint(accounts[2], 10);
                await stakeToken.approve(oracle.address, 10, {from: accounts[2]});
                await oracle.stakeTokens(mockedResolutionEngine.address, 0, false, 10, {from: accounts[2]});

                await stakeToken.mint(accounts[3], 50);
                await stakeToken.approve(oracle.address, 50, {from: accounts[3]});
                await oracle.stakeTokens(mockedResolutionEngine.address, 0, true, 50, {from: accounts[3]});

                await stakeToken.mint(accounts[4], 90);
                await stakeToken.approve(oracle.address, 90, {from: accounts[4]});
                await oracle.stakeTokens(mockedResolutionEngine.address, 0, false, 90, {from: accounts[4]});

                await mockedResolutionEngine._closeVerificationPhase();
            });

            it('should return 0', async () => {
                const payout = await mockedResolutionEngine.calculatePayout.call(0, accounts[2]);

                payout.should.eq.BN(115); // Including 10 tokens staked
            });
        });
    });

    describe('extractBounty()', () => {
        let mockedResolutionEngine, balanceBefore;

        beforeEach(async () => {
            bountyFund = await BountyFund.new(stakeToken.address);
            await stakeToken.mint(bountyFund.address, 100);

            const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
            mockedResolutionEngine = await MockedResolutionEngine.new(oracleAddress, bountyFund.address, bountyFraction);

            balanceBefore = await stakeToken.balanceOf.call(mockedResolutionEngine.address);
        });

        it('should successfully withdraw', async () => {
            await mockedResolutionEngine._extractBounty();

            (await stakeToken.balanceOf.call(mockedResolutionEngine.address)).should.eq.BN(balanceBefore.addn(9));
        });
    });

    describe('openVerificationPhase()', () => {
        describe('if verification phase is already opened', () => {
            let mockedResolutionEngine;

            beforeEach(async () => {
                bountyFund = await BountyFund.new(stakeToken.address);
                await stakeToken.mint(bountyFund.address, 100);

                const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
                mockedResolutionEngine = await MockedResolutionEngine.new(oracleAddress, bountyFund.address, bountyFraction);
            });

            it('should revert', async () => {
                mockedResolutionEngine._openVerificationPhase().should.be.rejected;
            });
        });
    });

    describe('closeVerificationPhase()', () => {
        let mockedResolutionEngine, verificationPhaseNumberBefore, bountyBalanceBefore;

        describe('if resolution result equals verification status', () => {
            beforeEach(async () => {
                bountyFund = await BountyFund.new(stakeToken.address);
                await stakeToken.mint(bountyFund.address, 100);

                const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
                mockedResolutionEngine = await MockedResolutionEngine.new(oracleAddress, bountyFund.address, bountyFraction);

                verificationPhaseNumberBefore = await mockedResolutionEngine.verificationPhaseNumber.call();
                bountyBalanceBefore = await stakeToken.balanceOf.call(bountyFund.address);
            });

            it('should successfully close the verification phase without toggling verification status', async () => {
                await mockedResolutionEngine._closeVerificationPhase();

                const result = await mockedResolutionEngine.metricsByVerificationPhaseNumber(0);
                result.startBlock.should.exist.and.be.gt.BN(0);
                result.endBlock.should.exist.and.be.gt.BN(0);
                result.numberOfBlocks.should.exist.and.be.eq.BN(result.endBlock.sub(result.startBlock));
                result.bountyAwarded.should.exist.and.be.false;

                (await stakeToken.balanceOf.call(bountyFund.address)).should.eq.BN(bountyBalanceBefore);

                (await mockedResolutionEngine.verificationPhaseNumber.call()).should.be.eq.BN(verificationPhaseNumberBefore.addn(1));
            });
        });

        describe('if resolution result differs from verification status', () => {
            beforeEach(async () => {
                const oracle = await Oracle.new();

                bountyFund = await BountyFund.new(stakeToken.address);
                await stakeToken.mint(bountyFund.address, 100);

                const bountyFraction = (await bountyFund.PARTS_PER.call()).divn(10);
                mockedResolutionEngine = await MockedResolutionEngine.new(oracle.address, bountyFund.address, bountyFraction);
                await oracle.addResolutionEngine(mockedResolutionEngine.address);

                await stakeToken.mint(accounts[2], 100);
                await stakeToken.approve(oracle.address, 100, {from: accounts[2]});
                await oracle.stakeTokens(mockedResolutionEngine.address, 0, true, 100, {from: accounts[2]});

                verificationPhaseNumberBefore = await mockedResolutionEngine.verificationPhaseNumber.call();
                bountyBalanceBefore = await stakeToken.balanceOf.call(bountyFund.address);
            });

            it('should successfully close the verification phase and toggle verification status', async () => {
                await mockedResolutionEngine._closeVerificationPhase();

                const result = await mockedResolutionEngine.metricsByVerificationPhaseNumber.call(0);
                result.startBlock.should.exist.and.be.gt.BN(0);
                result.endBlock.should.exist.and.be.gt.BN(0);
                result.numberOfBlocks.should.exist.and.be.eq.BN(result.endBlock.sub(result.startBlock));
                result.bountyAwarded.should.exist.and.be.true;

                (await stakeToken.balanceOf.call(bountyFund.address)).should.eq.BN(bountyBalanceBefore.subn(9));

                (await mockedResolutionEngine.verificationPhaseNumber.call()).should.be.eq.BN(verificationPhaseNumberBefore.addn(1));
            });
        });
    });

    describe('withdrawPayout()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.withdrawPayout(accounts[2], 0, 0, {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called by oracle', () => {
            let mockedResolutionEngine;

            beforeEach(async () => {
                const oracle = await Oracle.new();

                bountyFund = await BountyFund.new(stakeToken.address);
                await stakeToken.mint(bountyFund.address, 1000);

                const bountyFraction = await bountyFund.PARTS_PER.call();
                mockedResolutionEngine = await MockedResolutionEngine.new(oracle.address, bountyFund.address, bountyFraction);
                await mockedResolutionEngine._setVerificationStatus(1);
                await oracle.addResolutionEngine(mockedResolutionEngine.address);

                await stakeToken.mint(accounts[2], 10);
                await stakeToken.approve(oracle.address, 10, {from: accounts[2]});
                await oracle.stakeTokens(mockedResolutionEngine.address, 0, false, 10, {from: accounts[2]});

                await stakeToken.mint(accounts[3], 50);
                await stakeToken.approve(oracle.address, 50, {from: accounts[3]});
                await oracle.stakeTokens(mockedResolutionEngine.address, 0, true, 50, {from: accounts[3]});

                await stakeToken.mint(accounts[4], 90);
                await stakeToken.approve(oracle.address, 90, {from: accounts[4]});
                await oracle.stakeTokens(mockedResolutionEngine.address, 0, false, 90, {from: accounts[4]});
            });

            describe('if called on verification phase that has not closed', () => {
                it('should withdraw 0', async () => {
                    await mockedResolutionEngine._withdrawPayout(accounts[2], 0, 0);

                    (await stakeToken.balanceOf.call(accounts[2])).should.eq.BN(0);
                });
            });

            describe('if called the first time on verification phase that has closed', () => {
                beforeEach(async () => {
                    await mockedResolutionEngine._closeVerificationPhase();
                });

                it('should successfully withdraw payout', async () => {
                    await mockedResolutionEngine._withdrawPayout(accounts[2], 0, 0);

                    (await stakeToken.balanceOf.call(accounts[2])).should.eq.BN(115);
                });
            });

            describe('if called the second time on verification phase that has closed', () => {
                let balanceBefore;

                beforeEach(async () => {
                    await mockedResolutionEngine._closeVerificationPhase();
                    await mockedResolutionEngine._withdrawPayout(accounts[2], 0, 0);

                    balanceBefore = await stakeToken.balanceOf.call(accounts[2]);
                });

                it('should withdraw 0', async () => {
                    await mockedResolutionEngine._withdrawPayout(accounts[2], 0, 0);

                    (await stakeToken.balanceOf.call(accounts[2])).should.eq.BN(balanceBefore);
                });
            });
        });
    });
});
