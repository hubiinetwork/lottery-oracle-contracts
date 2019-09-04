/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const {providers} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const StakeToken = artifacts.require('StakeToken');
const Oracle = artifacts.require('Oracle');
const ResolutionEngineOperator = artifacts.require('ResolutionEngineOperator');
const BountyFund = artifacts.require('BountyFund');
const FractionalBalanceAllocator = artifacts.require('FractionalBalanceAllocator');
const NaiveTotalResolutionEngine = artifacts.require('NaiveTotalResolutionEngine');

contract('*', (accounts) => {
    let provider;
    let stakeToken, oracle, operator, bountyFund, bountyAllocator, naiveTotalResolutionEngine;
    let balanceBeforeAccount1, balanceBeforeAccount2;

    before(() => {
        provider = (new providers.Web3Provider(web3.currentProvider)).getSigner(accounts[0]).provider;
    });

    // Focus on on the NaiveTotalResolutionEngine
    describe('NaiveTotalResolutionEngine', () => {
        before(async () => {
            // Deploy test token
            stakeToken = await StakeToken.new('Lottery Oracle Token', 'LOT', 15);

            // Mint tokens for default account
            await stakeToken.mint(accounts[0], 1000);

            // Deploy oracle
            oracle = await Oracle.new();

            // Deploy resolution engine operator
            operator = await ResolutionEngineOperator.new(2);

            // Deploy bounty fund
            bountyFund = await BountyFund.new(stakeToken.address);

            // Deploy fractional balance allocator for bounty
            bountyAllocator = await FractionalBalanceAllocator.new(
                new BN('10').pow(new BN('17'))
            );

            // Deposit tokens into bounty fund
            await stakeToken.approve(bountyFund.address, 1000);
            await bountyFund.depositTokens(1000);
            // await stakeToken.mint(bountyFund.address, 1000);

            // Mint tokens for wallets and approve of oracle transferring
            await stakeToken.mint(accounts[1], 1000);
            await stakeToken.approve(oracle.address, 1000, {from: accounts[1]});
            await stakeToken.mint(accounts[2], 1000);
            await stakeToken.approve(oracle.address, 1000, {from: accounts[2]});

            // Deploy naïve total resolution engine and register it with oracle
            naiveTotalResolutionEngine = await NaiveTotalResolutionEngine.new(
                oracle.address, operator.address, bountyFund.address, 100
            );
            await naiveTotalResolutionEngine.setBountyAllocator(bountyAllocator.address);
            await naiveTotalResolutionEngine.initialize();

            // Add resolution engine to oracle
            await oracle.addResolutionEngine(naiveTotalResolutionEngine.address);
        });

        describe('initialize', () => {
            it('should initialize successfully', async () => {
                (await naiveTotalResolutionEngine.verificationPhaseNumber()).should.eq.BN(1);
                (await naiveTotalResolutionEngine.verificationStatus()).should.eq.BN(0);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumber(1)).bountyAmount
                    .should.eq.BN(100);
            });
        });

        describe('stake into first verification phase below resolution criteria', () => {
            before(async () => {
                balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
                balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);
            });

            it('should stake successfully but not close verification phase', async () => {
                await oracle.stake(naiveTotalResolutionEngine.address, 1, true, 10, {from: accounts[1]});
                await oracle.stake(naiveTotalResolutionEngine.address, 1, false, 20, {from: accounts[2]});

                (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.subn(10));
                (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2.subn(20));

                (await naiveTotalResolutionEngine.verificationPhaseNumber()).should.eq.BN(1);
                (await naiveTotalResolutionEngine.verificationStatus()).should.eq.BN(0);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumber(1)).bountyAmount
                    .should.eq.BN(100);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[1]))
                    .trueStakeAmount.should.eq.BN(10);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[2]))
                    .falseStakeAmount.should.eq.BN(20);
            });
        });

        describe('stake into first verification phase and surpass resolution criteria', () => {
            before(async () => {
                balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
                balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);
            });

            it('should stake successfully and close verification phase', async () => {
                // Stake above resolution criteria on the true status, thus close first verification phase
                // and change resolution engine's verification status
                await oracle.stake(naiveTotalResolutionEngine.address, 1, true, 100, {from: accounts[1]});

                (await naiveTotalResolutionEngine.verificationStatus()).should.eq.BN(1);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumber(1)).bountyAwarded
                    .should.be.true;
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[1]))
                    .trueStakeAmount.should.eq.BN(100);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[2]))
                    .falseStakeAmount.should.eq.BN(20);

                (await naiveTotalResolutionEngine.verificationPhaseNumber()).should.eq.BN(2);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumber(2)).bountyAmount
                    .should.eq.BN(90);

                (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.subn(100));
                (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2);
            });
        });

        describe('stake into second verification phase and surpass resolution criteria', () => {
            before(async () => {
                balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
                balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);
            });

            it('should stake successfully and close verification phase', async () => {
                // Stake above resolution criteria on the false status, thus close the second verification phase
                // and change resolution engine's verification status
                await oracle.stake(naiveTotalResolutionEngine.address, 2, true, 10, {from: accounts[1]});
                await oracle.stake(naiveTotalResolutionEngine.address, 2, false, 120, {from: accounts[2]});

                (await naiveTotalResolutionEngine.verificationStatus()).should.eq.BN(2);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumber(2)).bountyAwarded
                    .should.be.true;
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(2, accounts[1]))
                    .trueStakeAmount.should.eq.BN(10);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(2, accounts[2]))
                    .falseStakeAmount.should.eq.BN(100);

                (await naiveTotalResolutionEngine.verificationPhaseNumber()).should.eq.BN(3);
                (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumber(3)).bountyAmount
                    .should.eq.BN(81);

                (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.subn(10));
                (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2.subn(120));
            });
        });

        describe('stage payout', () => {
            it('should stage payout successfully', async () => {
                (await oracle.stagePayout(naiveTotalResolutionEngine.address, 1, 2, {from: accounts[1]}));
                (await oracle.stagePayout(naiveTotalResolutionEngine.address, 1, 2, {from: accounts[2]}));

                // Payout staged for accounts[1]:
                // phase1: 100% * (bounty of 100 + opposite stake of 20) + own stake of 110
                // phase2: 0
                (await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[1])).should.eq.BN(100 + 20 + 110);

                // Payout staged for accounts[2]:
                // phase1: 0
                // phase2: 100% * (bounty of 90 + opposite stake of 10) + own stake of 120
                (await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(90 + 10 + 120);
            });
        });

        describe('withdraw', () => {
            let stagedAmountBeforeAccount1, stagedAmountBeforeAccount2;

            before(async () => {
                balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
                balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);

                stagedAmountBeforeAccount1 = await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[1]);
                stagedAmountBeforeAccount2 = await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[2]);
            });

            it('should withdraw successfully', async () => {
                (await oracle.withdraw(naiveTotalResolutionEngine.address, 100, {from: accounts[1]}));
                (await oracle.withdraw(naiveTotalResolutionEngine.address, 100, {from: accounts[2]}));

                (await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[1])).should.eq.BN(stagedAmountBeforeAccount1.subn(100));
                (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.addn(100));

                (await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(stagedAmountBeforeAccount2.subn(100));
                (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2.addn(100));
            });
        });
    });

    // Focus on on the ResolutionEngineOperator
    describe('ResolutionEngineOperator', () => {
        before(async () => {
            // Deploy test token
            stakeToken = await StakeToken.new('Lottery Oracle Token', 'LOT', 15);

            // Mint tokens for default account
            await stakeToken.mint(accounts[0], 1000);

            // Deploy oracle
            oracle = await Oracle.new();

            // Deploy bounty fund
            bountyFund = await BountyFund.new(stakeToken.address);

            // Deploy resolution engine operator
            operator = await ResolutionEngineOperator.new(2);

            // Deploy fractional balance allocator for bounty
            bountyAllocator = await FractionalBalanceAllocator.new(
                new BN('10').pow(new BN('17'))
            );

            // Deploy naïve total resolution engine and register it with oracle
            naiveTotalResolutionEngine = await NaiveTotalResolutionEngine.new(
                oracle.address, operator.address, bountyFund.address, 100
            );
            await naiveTotalResolutionEngine.setBountyAllocator(bountyAllocator.address);
            await naiveTotalResolutionEngine.initialize();

            // Add resolution engine to oracle
            await oracle.addResolutionEngine(naiveTotalResolutionEngine.address);

            // Deposit tokens into bounty fund
            await stakeToken.approve(bountyFund.address, 1000);
            await bountyFund.depositTokens(1000);

            // Mint tokens for wallet and approve of oracle transferring
            await stakeToken.mint(accounts[1], 1000);
            await stakeToken.approve(oracle.address, 1000, {from: accounts[1]});
        });

        // describe('initialize', () => {
        //     it('should initialize successfully', async () => {
        //     });
        // });

        describe('start first timer', () => {
            before(async () => {
                // Stake into the first verification phase
                await oracle.stake(naiveTotalResolutionEngine.address, 1, true, 10, {from: accounts[1]});
                await oracle.stake(naiveTotalResolutionEngine.address, 1, false, 20, {from: accounts[1]});
            });

            it('should start successfully', async () => {
                await operator.startDisablementTimer(naiveTotalResolutionEngine.address, 10);

                (await operator.isDisablementTimerExpired(naiveTotalResolutionEngine.address)).should.be.false;

                (await naiveTotalResolutionEngine.disabled(await naiveTotalResolutionEngine.STAKE_ACTION())).should.be.true;
                (await naiveTotalResolutionEngine.disabled(await naiveTotalResolutionEngine.RESOLVE_ACTION())).should.be.false;
            });
        });

        describe('stop first timer', () => {
            it('should stop successfully', async () => {
                await operator.stopDisablementTimer(naiveTotalResolutionEngine.address);

                (await operator.isDisablementTimerExpired(naiveTotalResolutionEngine.address)).should.be.true;

                (await naiveTotalResolutionEngine.disabled(await naiveTotalResolutionEngine.STAKE_ACTION())).should.be.false;
                (await naiveTotalResolutionEngine.disabled(await naiveTotalResolutionEngine.RESOLVE_ACTION())).should.be.false;
            });
        });

        describe('start second timer', () => {
            it('should start successfully', async () => {
                await operator.startDisablementTimer(naiveTotalResolutionEngine.address, 2);

                (await naiveTotalResolutionEngine.disabled(await naiveTotalResolutionEngine.STAKE_ACTION())).should.be.true;
                (await naiveTotalResolutionEngine.disabled(await naiveTotalResolutionEngine.RESOLVE_ACTION())).should.be.false;
            });
        });

        describe('disable resolution engine', () => {
            before(async () => {
                // TODO Factor this fast forward out into separate function in ./helpers.js
                await provider.send('evm_increaseTime', [3]);
                await provider.send('evm_mine');
            });

            it('should disable successfully', async () => {
                (await operator.isDisablementTimerExpired(naiveTotalResolutionEngine.address)).should.be.true;

                await operator.disable(naiveTotalResolutionEngine.address);

                (await naiveTotalResolutionEngine.disabled(await naiveTotalResolutionEngine.STAKE_ACTION())).should.be.true;
                (await naiveTotalResolutionEngine.disabled(await naiveTotalResolutionEngine.RESOLVE_ACTION())).should.be.true;
            });
        });

        describe('stage bounty from resolution engine', () => {
            it('should stage successfully', async () => {
                await naiveTotalResolutionEngine.stageBounty(accounts[2]);

                (await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(
                    (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumber(1)).bountyAmount
                );
            });
        });

        describe('withdraw bounty from resolution engine', () => {
            let bountyAmount;

            before(async () => {
                balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);
                bountyAmount = (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumber(1)).bountyAmount;
            });

            it('should withdraw successfully', async () => {
                await oracle.withdraw(naiveTotalResolutionEngine.address, bountyAmount, {from: accounts[2]});

                (await stakeToken.balanceOf(accounts[2])).should.eq.BN(
                    balanceBeforeAccount2.add(bountyAmount)
                );
            });
        });

        describe('stage stake from resolution engine', () => {
            it('should stage successfully', async () => {
                await oracle.stageStake(naiveTotalResolutionEngine.address, {from: accounts[1]});

                (await naiveTotalResolutionEngine.stagedAmountByWallet(accounts[1])).should.eq.BN(10 + 20);
            });
        });

        describe('withdraw stake from resolution engine', () => {
            let stakeAmount;

            before(async () => {
                balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
                stakeAmount = (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[1])).stakeAmount;
            });

            it('should withdraw successfully', async () => {
                await oracle.withdraw(naiveTotalResolutionEngine.address, stakeAmount, {from: accounts[1]});

                (await stakeToken.balanceOf(accounts[1])).should.eq.BN(
                    balanceBeforeAccount1.add(stakeAmount)
                );
            });
        });
    });
});
