/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2018 Hubii AS
 */

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const {Wallet, providers} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const StakeToken = artifacts.require('StakeToken');
const BountyFund = artifacts.require('BountyFund');
const NaiveTotalResolutionEngine = artifacts.require('NaiveTotalResolutionEngine');

contract('NaiveTotalResolutionEngine', (accounts) => {
    let ownerAddress, operatorAddress, oracleAddress;
    let provider;
    let stakeToken, resolutionEngine, bountyFund, bountyFraction;
    let ownerRole, oracleRole, operatorRole;

    beforeEach(async () => {
        ownerAddress = accounts[0];
        operatorAddress = accounts[0];
        oracleAddress = accounts[1];

        provider = (new providers.Web3Provider(web3.currentProvider)).getSigner(ownerAddress).provider;

        stakeToken = await StakeToken.new('hubiit', 'HBT', 15);

        bountyFund = await BountyFund.new(stakeToken.address);
        await stakeToken.mint(bountyFund.address, 100);

        bountyFraction = (await bountyFund.PARTS_PER()).divn(10);
        resolutionEngine = await NaiveTotalResolutionEngine.new(
            oracleAddress, operatorAddress, bountyFund.address, bountyFraction, 100
        );

        ownerRole = await resolutionEngine.OWNER_ROLE();
        oracleRole = await resolutionEngine.ORACLE_ROLE();
        operatorRole = await resolutionEngine.OPERATOR_ROLE();
    });

    describe('constructor()', () => {
        it('should successfully initialize', async () => {
            // TODO Add tests on events emitted at construction time

            (await resolutionEngine.isRole(ownerRole)).should.be.true;
            (await resolutionEngine.isRoleAccessor(ownerRole, ownerAddress)).should.be.true;
            (await resolutionEngine.isRoleAccessor(ownerRole, oracleAddress)).should.be.false;

            (await resolutionEngine.oracle()).should.equal(oracleAddress);

            (await resolutionEngine.operator()).should.equal(operatorAddress);

            (await resolutionEngine.bounty()).fraction.should.be.eq.BN(bountyFraction);
            (await resolutionEngine.bounty()).amount.should.be.eq.BN(10);
            (await resolutionEngine.verificationPhaseNumber()).should.be.eq.BN(1);

            (await stakeToken.balanceOf(resolutionEngine.address))
                .should.eq.BN(10);
        });
    });

    describe('disable()', () => {
        describe('if called by non-operator', () => {
            it('should revert', async () => {
                resolutionEngine.disable('some action', {from: oracleAddress}).should.be.rejected;
            });
        });

        describe('if called by operator on resolution engine with action enabled', () => {
            it('should successfully disable the resolution engine', async () => {
                const result = await resolutionEngine.disable('some action');
                result.logs[0].event.should.equal('Disabled');
            });
        });

        describe('if called by operator on resolution engine with action disabled', () => {
            beforeEach(async () => {
                await resolutionEngine.disable('some action');
            });

            it('should revert', async () => {
                resolutionEngine.disable('some action').should.be.rejected;
            });
        });
    });

    describe('enable()', () => {
        describe('if called by non-operator', () => {
            it('should revert', async () => {
                resolutionEngine.enable('some action', {from: oracleAddress}).should.be.rejected;
            });
        });

        describe('if called by operator on resolution engine with action disabled', () => {
            beforeEach(async () => {
                await resolutionEngine.disable('some action');
            });

            it('should successfully enable the resolution engine', async () => {
                const result = await resolutionEngine.enable('some action');
                result.logs[0].event.should.equal('Enabled');
            });
        });

        describe('if called by operator on resolution engine with action enabled', () => {
            it('should revert', async () => {
                resolutionEngine.enable('some action').should.be.rejected;
            });
        });
    });

    describe('stake()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.stake(accounts[2], true, 100, {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if stake action disabled', () => {
            beforeEach(async () => {
                await resolutionEngine.disable(await resolutionEngine.STAKE_ACTION());
            });

            it('should revert', async () => {
                resolutionEngine.stake(accounts[2], true, 100, {from: oracleAddress}).should.be.rejected;
            });
        });

        describe('if called by oracle', () => {
            it('should successfully update metrics', async () => {
                const result = await resolutionEngine.stake(accounts[2], true, 100, {from: oracleAddress});
                result.logs[0].event.should.equal('Staked');
            });
        });
    });

    describe('resolutionCriteriaMet()', () => {
        describe('if resolution criteria have not been met', () => {
            beforeEach(async () => {
                await resolutionEngine.stake(accounts[2], true, 10, {from: oracleAddress});
                await resolutionEngine.stake(accounts[3], false, 20, {from: oracleAddress});
            });

            it('should return false', async () => {
                (await resolutionEngine.resolutionCriteriaMet()).should.be.false;
            });
        });

        describe('if resolution criteria have been met on true status', () => {
            beforeEach(async () => {
                await resolutionEngine.stake(accounts[2], true, 110, {from: oracleAddress});
                await resolutionEngine.stake(accounts[3], false, 20, {from: oracleAddress});
            });

            it('should return true', async () => {
                (await resolutionEngine.resolutionCriteriaMet()).should.be.true;
            });
        });

        describe('if resolution criteria have been met on false status', () => {
            beforeEach(async () => {
                await resolutionEngine.stake(accounts[2], true, 10, {from: oracleAddress});
                await resolutionEngine.stake(accounts[3], false, 120, {from: oracleAddress});
            });

            it('should return true', async () => {
                (await resolutionEngine.resolutionCriteriaMet()).should.be.true;
            });
        });
    });

    describe('metricsByVerificationPhaseNumber()', () => {
        describe('if verification phase has opened', () => {
            beforeEach(async () => {
                await resolutionEngine.stake(accounts[2], true, 10, {from: oracleAddress});
                await resolutionEngine.stake(accounts[3], false, 20, {from: oracleAddress});
            });

            it('should return metrics of started verification phase', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumber(1);

                result.state.should.exist.and.eq.BN(1);
                result.trueStakeAmount.should.exist.and.eq.BN(10);
                result.falseStakeAmount.should.exist.and.eq.BN(20);
                result.stakeAmount.should.exist.and.eq.BN(30);
                result.numberOfWallets.should.exist.and.eq.BN(2);
                result.bountyAmount.should.exist.and.be.eq.BN(10);
                result.bountyAwarded.should.exist.and.be.false;
                result.startBlock.should.exist.and.be.gt.BN(0);
                result.endBlock.should.exist.and.eq.BN(0);
                result.numberOfBlocks.should.exist.and.eq.BN(2);
            });
        });

        describe('if verification phase has not opened', () => {
            it('should return metrics with default values', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumber(2);

                result.state.should.exist.and.eq.BN(0);
                result.trueStakeAmount.should.exist.and.eq.BN(0);
                result.falseStakeAmount.should.exist.and.eq.BN(0);
                result.stakeAmount.should.exist.and.eq.BN(0);
                result.numberOfWallets.should.exist.and.eq.BN(0);
                result.bountyAmount.should.exist.and.be.eq.BN(0);
                result.bountyAwarded.should.exist.and.be.false;
                result.startBlock.should.exist.and.eq.BN(0);
                result.endBlock.should.exist.and.eq.BN(0);
                result.numberOfBlocks.should.exist.and.eq.BN(0);
            });
        });
    });

    describe('metricsByVerificationPhaseNumberAndWallet()', () => {
        describe('if verification phase has opened', () => {
            beforeEach(async () => {
                await resolutionEngine.stake(accounts[2], true, 10, {from: oracleAddress});
                await resolutionEngine.stake(accounts[2], false, 20, {from: oracleAddress});
            });

            it('should return metrics of started verification phase', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[2]);

                result.trueStakeAmount.should.exist.and.eq.BN(10);
                result.falseStakeAmount.should.exist.and.eq.BN(20);
                result.stakeAmount.should.exist.and.eq.BN(30);
            });
        });

        describe('if verification phase has not opened', () => {
            it('should return metrics with default values', async () => {
                const result = await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(2, Wallet.createRandom().address);

                result.trueStakeAmount.should.exist.and.eq.BN(0);
                result.falseStakeAmount.should.exist.and.eq.BN(0);
                result.stakeAmount.should.exist.and.eq.BN(0);
            });
        });
    });

    describe('metricsByWallet()', () => {
        beforeEach(async () => {
            await resolutionEngine.stake(accounts[2], true, 10, {from: oracleAddress});
            await resolutionEngine.stake(accounts[2], false, 20, {from: oracleAddress});
        });

        it('should return metrics of wallet', async () => {
            const result = await resolutionEngine.metricsByWallet(accounts[2]);

            result.trueStakeAmount.should.exist.and.eq.BN(10);
            result.falseStakeAmount.should.exist.and.eq.BN(20);
            result.stakeAmount.should.exist.and.eq.BN(30);
        });
    });

    describe('metricsByBlockNumber()', () => {
        let blockNumber;

        beforeEach(async () => {
            await resolutionEngine.stake(accounts[2], true, 10, {from: oracleAddress});
            await resolutionEngine.stake(accounts[2], false, 20, {from: oracleAddress});

            blockNumber = await provider.getBlockNumber();
        });

        it('should return metrics of block number', async () => {
            const result1 = await resolutionEngine.metricsByBlockNumber(blockNumber - 1);

            result1.trueStakeAmount.should.exist.and.eq.BN(10);
            result1.falseStakeAmount.should.exist.and.eq.BN(0);
            result1.stakeAmount.should.exist.and.eq.BN(10);

            const result2 = await resolutionEngine.metricsByBlockNumber(blockNumber);

            result2.trueStakeAmount.should.exist.and.eq.BN(0);
            result2.falseStakeAmount.should.exist.and.eq.BN(20);
            result2.stakeAmount.should.exist.and.eq.BN(20);
        });
    });

    describe('resolveIfCriteriaMet()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.resolveIfCriteriaMet({from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if resolve action is disabled', () => {
            beforeEach(async () => {
                await resolutionEngine.disable(await resolutionEngine.RESOLVE_ACTION());
            });

            it('should revert', async () => {
                resolutionEngine.resolveIfCriteriaMet({from: oracleAddress}).should.be.rejected;
            });
        });

        describe('if called when resolution criteria are not met', () => {
            it('should not resolve', async () => {
                const result = await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});

                result.logs.should.be.empty;

                (await resolutionEngine.verificationPhaseNumber()).should.be.eq.BN(1);

                (await resolutionEngine.metricsByVerificationPhaseNumber(1)).state.should.eq.BN(1);
                (await resolutionEngine.metricsByVerificationPhaseNumber(2)).state.should.eq.BN(0);
            });
        });

        describe('if called when resolution criteria are met', () => {
            beforeEach(async () => {
                await resolutionEngine.stake(accounts[2], true, 110, {from: oracleAddress});
                await resolutionEngine.stake(accounts[3], false, 20, {from: oracleAddress});
            });

            it('should successfully resolve', async () => {
                const result = await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});

                result.logs.map(l => l.event).should.include('VerificationPhaseOpened');
                result.logs.map(l => l.event).should.include('Resolved');
                result.logs.map(l => l.event).should.include('VerificationPhaseClosed');

                (await resolutionEngine.verificationPhaseNumber()).should.be.eq.BN(2);

                (await resolutionEngine.metricsByVerificationPhaseNumber(1)).state.should.eq.BN(2);
                (await resolutionEngine.metricsByVerificationPhaseNumber(2)).state.should.eq.BN(1);
            });
        });
    });

    describe('calculatePayout()', () => {
        describe('if resolution result is null-status', () => {
            it('should return 0', async () => {
                (await resolutionEngine.calculatePayout(0, Wallet.createRandom().address))
                    .should.eq.BN(0);
            });
        });

        // 2nd scenario in https://docs.google.com/document/d/1o_8BCMLXMNzEJ4uovZdeYUkEmRJPktf_fi55jylJ24w/edit#heading=h.e522u33ktgp6
        describe('if bounty was awarded', () => {
            beforeEach(async () => {
                await resolutionEngine.stake(accounts[2], true, 10, {from: oracleAddress});
                await resolutionEngine.stake(accounts[3], true, 90, {from: oracleAddress});
                await resolutionEngine.stake(accounts[4], false, 50, {from: oracleAddress});

                await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});
            });

            it('should return 0', async () => {
                (await resolutionEngine.calculatePayout(1, accounts[2]))
                    .should.eq.BN(16); // Including 10 tokens staked
            });
        });

        // 1st scenario in https://docs.google.com/document/d/1o_8BCMLXMNzEJ4uovZdeYUkEmRJPktf_fi55jylJ24w/edit#heading=h.e522u33ktgp6
        describe('if bounty was not awarded', () => {
            beforeEach(async () => {
                await resolutionEngine.stake(accounts[2], true, 100, {from: oracleAddress});

                await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});

                await resolutionEngine.stake(accounts[2], true, 10, {from: oracleAddress});
                await resolutionEngine.stake(accounts[3], true, 90, {from: oracleAddress});
                await resolutionEngine.stake(accounts[4], false, 50, {from: oracleAddress});

                await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});
            });

            it('should return 0', async () => {
                (await resolutionEngine.calculatePayout(2, accounts[2]))
                    .should.eq.BN(15); // Including 10 tokens staked
            });
        });
    });

    describe('stagePayout()', () => {
        beforeEach(async () => {
            await resolutionEngine.stake(accounts[2], true, 10, {from: oracleAddress});
            await resolutionEngine.stake(accounts[3], true, 90, {from: oracleAddress});
            await resolutionEngine.stake(accounts[4], false, 50, {from: oracleAddress});
        });

        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.stagePayout(accounts[2], 0, 0, {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called on verification phase that has not closed', () => {
            it('should stage 0', async () => {
                await resolutionEngine.stagePayout(accounts[2], 1, 1, {from: oracleAddress});

                (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(0);
            });
        });

        describe('if called the first time on verification phase that has closed', () => {
            beforeEach(async () => {
                await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});
            });

            it('should successfully stage payout', async () => {
                await resolutionEngine.stagePayout(accounts[2], 1, 1, {from: oracleAddress});

                (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(16);
            });
        });

        describe('if called the second time on verification phase that has closed', () => {
            beforeEach(async () => {
                await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress});

                await resolutionEngine.stagePayout(accounts[2], 1, 1, {from: oracleAddress});
            });

            it('should stage 0', async () => {
                await resolutionEngine.stagePayout(accounts[2], 1, 1, {from: oracleAddress});

                (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(16);
            });
        });
    });

    describe('stageStake()', () => {
        beforeEach(async () => {
            await resolutionEngine.stake(accounts[2], true, 10, {from: oracleAddress});
            await resolutionEngine.stake(accounts[2], false, 20, {from: oracleAddress});
            await resolutionEngine.stake(accounts[3], true, 40, {from: oracleAddress});
        });

        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.stageStake(accounts[2], {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called when resolve action is enabled', () => {
            it('should revert', async () => {
                resolutionEngine.stageStake(accounts[2], {from: oracleAddress}).should.be.rejected;
            });
        });

        describe('if called by oracle when resolve action is disabled', () => {
            beforeEach(async () => {
                await resolutionEngine.disable(await resolutionEngine.RESOLVE_ACTION());
            });

            it('should successfully stage stake', async () => {
                await resolutionEngine.stageStake(accounts[2], {from: oracleAddress});

                (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(30);
            });
        });
    });

    describe('stage()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.stage(accounts[2], 100, {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called by oracle', () => {
            it('should successfully stage', async () => {
                const result = await resolutionEngine.stage(accounts[2], 100, {from: oracleAddress});

                result.logs[0].event.should.equal('Staged');

                (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(100);
            });
        });
    });

    describe('withdraw()', () => {
        describe('if called by non-oracle', () => {
            it('should revert', async () => {
                resolutionEngine.withdraw(accounts[2], 100, {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called with amount greater than staged amount', () => {
            it('should revert', async () => {
                (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(0);

                resolutionEngine.withdraw(accounts[2], 100, {from: oracleAddress}).should.be.rejected;
            });
        });

        describe('if called with amount smaller or equal to staged amount', () => {
            beforeEach(async () => {
                await resolutionEngine.stage(accounts[2], 100, {from: oracleAddress});

                await stakeToken.mint(resolutionEngine.address, 100);
            });

            it('should successfully withdraw', async () => {
                const result = await resolutionEngine.withdraw(accounts[2], 40, {from: oracleAddress});

                result.logs[0].event.should.equal('Withdrawn');

                (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(60);

                (await stakeToken.balanceOf(accounts[2])).should.eq.BN(40);
            });
        });
    });

    describe('stageBounty()', () => {
        describe('if called by non-owner', () => {
            it('should revert', async () => {
                resolutionEngine.stageBounty(accounts[2], {from: accounts[2]}).should.be.rejected;
            });
        });

        describe('if called on enabled resolution engine', () => {
            it('should revert', async () => {
                resolutionEngine.stageBounty(accounts[2]).should.be.rejected;
            });
        });

        describe('if called by owner on disabled resolution engine', () => {
            let bountyAmount;

            beforeEach(async () => {
                bountyAmount = (await resolutionEngine.bounty()).amount;

                await resolutionEngine.disable(await resolutionEngine.RESOLVE_ACTION());
            });

            it('should successfully stage the bounty', async () => {
                const result = await resolutionEngine.stageBounty(accounts[2]);
                result.logs[0].event.should.equal('BountyStaged');
                (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(bountyAmount);
            });
        });
    });
});
