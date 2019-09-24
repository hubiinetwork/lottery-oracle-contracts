/*
 * Lottery oracle
 *
 * Copyright (C) 2017-2019 Hubii AS
 */

'use strict';
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const {providers} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const AlphaBetaGammaResolutionEngine = artifacts.require('AlphaBetaGammaResolutionEngine');
const BountyFund = artifacts.require('BountyFund');
const FractionalBalanceAllocator = artifacts.require('FractionalBalanceAllocator');
const NaiveTotalResolutionEngine = artifacts.require('NaiveTotalResolutionEngine');
const Oracle = artifacts.require('Oracle');
const Operator = artifacts.require('Operator');
const StakeToken = artifacts.require('StakeToken');

contract('*', (accounts) => {
  let provider;
  let stakeToken, oracle, operator, bountyFund, bountyAllocator;

  before(() => {
    provider = (new providers.Web3Provider(web3.currentProvider)).getSigner(accounts[0]).provider;
  });

  // Focus on on the Operator
  describe('Operator', () => {
    let naiveTotalResolutionEngine;
    let balanceBeforeAccount1, balanceBeforeAccount2;

    before(async () => {
      // Deploy test token
      stakeToken = await StakeToken.new('Lottery Oracle Token', 'LOT', 15);

      // Mint tokens for default account
      await stakeToken.mint(accounts[0], 1000);

      // Deploy oracle
      oracle = await Oracle.new();

      // Deploy resolution engine operator
      operator = await Operator.new(2);

      // Deploy bounty fund
      bountyFund = await BountyFund.new(stakeToken.address, operator.address);
      await stakeToken.mint(bountyFund.address, 1000);

      // Deploy fractional balance allocator for bounty
      bountyAllocator = await FractionalBalanceAllocator.new(web3.utils.toBN(1e17));

      // Deploy naïve total resolution engine and register it with oracle
      naiveTotalResolutionEngine = await NaiveTotalResolutionEngine.new(
        oracle.address, operator.address, bountyFund.address, 100
      );
      await naiveTotalResolutionEngine.setBountyAllocator(bountyAllocator.address);
      await naiveTotalResolutionEngine.initialize();

      // Add resolution engine to oracle
      await oracle.addResolutionEngine(naiveTotalResolutionEngine.address);

      // Mint tokens for wallet and approve of oracle transferring
      await stakeToken.mint(accounts[1], 1000);
      await stakeToken.approve(oracle.address, 1000, {from: accounts[1]});
    });

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

    describe('withdraw allocated bounty from resolution engine', () => {
      let bountyAmount;

      before(async () => {
        balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);
        bountyAmount = (await naiveTotalResolutionEngine.metricsByVerificationPhaseNumber(1)).bountyAmount;
      });

      it('should withdraw successfully', async () => {
        await operator.withdrawAllocatedBounty(naiveTotalResolutionEngine.address, accounts[2]);

        (await stakeToken.balanceOf(accounts[2])).should.eq.BN(
            balanceBeforeAccount2.add(bountyAmount)
        );
      });
    });

    describe('withdraw unallocated bounty from bounty fund', () => {
      let bountyAmount;

      before(async () => {
        balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);
        bountyAmount = await stakeToken.balanceOf(bountyFund.address);
      });

      it('should withdraw successfully', async () => {
        await operator.withdrawUnallocatedBounty(bountyFund.address, accounts[2]);

        (await stakeToken.balanceOf(accounts[2])).should.eq.BN(
            balanceBeforeAccount2.add(bountyAmount)
        );
      });
    });
  });

  // Focus on on the NaiveTotalResolutionEngine
  describe('NaiveTotalResolutionEngine', () => {
    let resolutionEngine;
    let balanceBeforeAccount1, balanceBeforeAccount2;

    before(async () => {
      // Deploy test token
      stakeToken = await StakeToken.new('Lottery Oracle Token', 'LOT', 15);

      // Mint tokens for default account
      await stakeToken.mint(accounts[0], 1000);

      // Deploy oracle
      oracle = await Oracle.new();

      // Deploy resolution engine operator
      operator = await Operator.new(2);

      // Deploy bounty fund
      bountyFund = await BountyFund.new(stakeToken.address, operator.address);

      // Deploy fractional balance allocator for bounty
      bountyAllocator = await FractionalBalanceAllocator.new(web3.utils.toBN(1e17));

      // Deposit tokens into bounty fund
      await stakeToken.approve(bountyFund.address, 1000);
      await bountyFund.depositTokens(1000);

      // Mint tokens for wallets and approve of oracle transferring
      await stakeToken.mint(accounts[1], 1000);
      await stakeToken.approve(oracle.address, 1000, {from: accounts[1]});
      await stakeToken.mint(accounts[2], 1000);
      await stakeToken.approve(oracle.address, 1000, {from: accounts[2]});

      // Deploy naïve total resolution engine and register it with oracle
      resolutionEngine = await NaiveTotalResolutionEngine.new(
        oracle.address, operator.address, bountyFund.address, 100
      );
      await resolutionEngine.setBountyAllocator(bountyAllocator.address);
      await resolutionEngine.initialize();

      // Add resolution engine to oracle
      await oracle.addResolutionEngine(resolutionEngine.address);
    });

    describe('initialize', () => {
      it('should initialize successfully', async () => {
        (await resolutionEngine.verificationPhaseNumber()).should.eq.BN(1);
        (await resolutionEngine.verificationStatus()).should.eq.BN(0);
        (await resolutionEngine.metricsByVerificationPhaseNumber(1)).bountyAmount
          .should.eq.BN(100);
      });
    });

    describe('stake into first verification phase below resolution criteria', () => {
      before(async () => {
        balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
        balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);
      });

      it('should stake successfully but not close verification phase', async () => {
        await oracle.stake(resolutionEngine.address, 1, true, 10, {from: accounts[1]});
        await oracle.stake(resolutionEngine.address, 1, false, 20, {from: accounts[2]});

        (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.subn(10));
        (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2.subn(20));

        (await resolutionEngine.verificationPhaseNumber()).should.eq.BN(1);
        (await resolutionEngine.verificationStatus()).should.eq.BN(0);
        (await resolutionEngine.metricsByVerificationPhaseNumber(1)).bountyAmount
          .should.eq.BN(100);
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[1]))
          .trueStakeAmount.should.eq.BN(10);
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[2]))
          .falseStakeAmount.should.eq.BN(20);
      });
    });

    describe('stake into first verification phase and surpass resolution criteria', () => {
      before(async () => {
        balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
        balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);
      });

      it('should stake successfully and close verification phase', async () => {
        // Stake above resolution criteria of the true status, thus close first verification phase
        // and change resolution engine's verification status
        await oracle.stake(resolutionEngine.address, 1, true, 100, {from: accounts[1]});

        (await resolutionEngine.verificationStatus()).should.eq.BN(1);
        (await resolutionEngine.metricsByVerificationPhaseNumber(1)).bountyAwarded
          .should.be.true;
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[1]))
          .trueStakeAmount.should.eq.BN(100);
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[2]))
          .falseStakeAmount.should.eq.BN(20);

        (await resolutionEngine.verificationPhaseNumber()).should.eq.BN(2);
        (await resolutionEngine.metricsByVerificationPhaseNumber(2)).bountyAmount
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
        await oracle.stake(resolutionEngine.address, 2, true, 10, {from: accounts[1]});
        await oracle.stake(resolutionEngine.address, 2, false, 120, {from: accounts[2]});

        (await resolutionEngine.verificationStatus()).should.eq.BN(2);
        (await resolutionEngine.metricsByVerificationPhaseNumber(2)).bountyAwarded
          .should.be.true;
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(2, accounts[1]))
          .trueStakeAmount.should.eq.BN(10);
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(2, accounts[2]))
          .falseStakeAmount.should.eq.BN(100);

        (await resolutionEngine.verificationPhaseNumber()).should.eq.BN(3);
        (await resolutionEngine.metricsByVerificationPhaseNumber(3)).bountyAmount
          .should.eq.BN(81);

        (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.subn(10));
        (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2.subn(120));
      });
    });

    describe('stage payout', () => {
      it('should stage payout successfully', async () => {
        (await oracle.stagePayout(resolutionEngine.address, 1, 2, {from: accounts[1]}));
        (await oracle.stagePayout(resolutionEngine.address, 1, 2, {from: accounts[2]}));

        // Payout staged for accounts[1]:
        // phase1: 100% * (bounty of 100 + opposite stake of 20) + own stake of 110
        // phase2: 0
        (await resolutionEngine.stagedAmountByWallet(accounts[1])).should.eq.BN(100 + 20 + 110);

        // Payout staged for accounts[2]:
        // phase1: 0
        // phase2: 100% * (bounty of 90 + opposite stake of 10) + own stake of 120
        (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(90 + 10 + 120);
      });
    });

    describe('withdraw', () => {
      let stagedAmountBeforeAccount1, stagedAmountBeforeAccount2;

      before(async () => {
        balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
        balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);

        stagedAmountBeforeAccount1 = await resolutionEngine.stagedAmountByWallet(accounts[1]);
        stagedAmountBeforeAccount2 = await resolutionEngine.stagedAmountByWallet(accounts[2]);
      });

      it('should withdraw successfully', async () => {
        (await oracle.withdraw(resolutionEngine.address, 100, {from: accounts[1]}));
        (await oracle.withdraw(resolutionEngine.address, 100, {from: accounts[2]}));

        (await resolutionEngine.stagedAmountByWallet(accounts[1])).should.eq.BN(stagedAmountBeforeAccount1.subn(100));
        (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.addn(100));

        (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(stagedAmountBeforeAccount2.subn(100));
        (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2.addn(100));
      });
    });
  });

  // Focus on on the AlphaBetaGammaResolutionEngine
  describe('AlphaBetaGammaResolutionEngine', () => {
    let resolutionEngine;
    let balanceBeforeAccount1, balanceBeforeAccount2, balanceBeforeAccount3;

    before(async () => {
      // Deploy test token
      stakeToken = await StakeToken.new('Lottery Oracle Token', 'LOT', 15);

      // Mint tokens for default account
      await stakeToken.mint(accounts[0], 1000);

      // Deploy oracle
      oracle = await Oracle.new();

      // Deploy resolution engine operator
      operator = await Operator.new(2);

      // Deploy bounty fund
      bountyFund = await BountyFund.new(stakeToken.address, operator.address);

      // Deploy fractional balance allocator for bounty
      bountyAllocator = await FractionalBalanceAllocator.new(web3.utils.toBN(1e17));

      // Deposit tokens into bounty fund
      await stakeToken.approve(bountyFund.address, 1000);
      await bountyFund.depositTokens(1000);

      // Mint tokens for wallets and approve of oracle transferring
      await stakeToken.mint(accounts[1], 1000);
      await stakeToken.approve(oracle.address, 1000, {from: accounts[1]});
      await stakeToken.mint(accounts[2], 1000);
      await stakeToken.approve(oracle.address, 1000, {from: accounts[2]});
      await stakeToken.mint(accounts[3], 1000);
      await stakeToken.approve(oracle.address, 1000, {from: accounts[3]});

      // Deploy naïve total resolution engine and register it with oracle
      resolutionEngine = await AlphaBetaGammaResolutionEngine.new(
        oracle.address, operator.address, bountyFund.address,
        2, web3.utils.toBN(6e17), 3
      );
      await resolutionEngine.setBountyAllocator(bountyAllocator.address);
      await resolutionEngine.initialize();

      // Add resolution engine to oracle
      await oracle.addResolutionEngine(resolutionEngine.address);
    });

    describe('initialize', () => {
      it('should initialize successfully', async () => {
        (await resolutionEngine.verificationPhaseNumber()).should.eq.BN(1);
        (await resolutionEngine.verificationStatus()).should.eq.BN(0);
        (await resolutionEngine.metricsByVerificationPhaseNumber(1)).bountyAmount
          .should.eq.BN(100);
      });
    });

    describe('stake into first verification phase below resolution criteria', () => {
      before(async () => {
        balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
        balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);
        balanceBeforeAccount3 = await stakeToken.balanceOf(accounts[3]);
      });

      it('should stake successfully but not close verification phase', async () => {
        await oracle.stake(resolutionEngine.address, 1, true, 1, {from: accounts[1]});
        await oracle.stake(resolutionEngine.address, 1, true, 2, {from: accounts[2]});
        await oracle.stake(resolutionEngine.address, 1, false, 3, {from: accounts[3]});

        (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.subn(1));
        (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2.subn(2));
        (await stakeToken.balanceOf(accounts[3])).should.eq.BN(balanceBeforeAccount2.subn(3));

        (await resolutionEngine.verificationPhaseNumber()).should.eq.BN(1);
        (await resolutionEngine.verificationStatus()).should.eq.BN(0);
        (await resolutionEngine.metricsByVerificationPhaseNumber(1)).bountyAmount
          .should.eq.BN(100);
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[1]))
          .trueStakeAmount.should.eq.BN(1);
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[2]))
          .trueStakeAmount.should.eq.BN(2);
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[3]))
          .falseStakeAmount.should.eq.BN(3);
      });
    });

    describe('stake into first verification phase and exactly surpass resolution criteria', () => {
      before(async () => {
        balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
        balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);
        balanceBeforeAccount3 = await stakeToken.balanceOf(accounts[3]);
      });

      it('should stake successfully and close verification phase', async () => {
        (await resolutionEngine.resolutionDeltaAmount(true)).should.eq.BN(194);

        // Stake exactly at resolution criteria of the true status, thus close first verification phase
        // and change resolution engine's verification status
        await oracle.stake(resolutionEngine.address, 1, true, 194, {from: accounts[1]});

        (await resolutionEngine.verificationStatus()).should.eq.BN(1);
        (await resolutionEngine.metricsByVerificationPhaseNumber(1)).bountyAwarded
          .should.be.true;
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[1]))
          .trueStakeAmount.should.eq.BN(195);
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[2]))
          .trueStakeAmount.should.eq.BN(2);
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(1, accounts[3]))
          .falseStakeAmount.should.eq.BN(3);

        (await resolutionEngine.verificationPhaseNumber()).should.eq.BN(2);
        (await resolutionEngine.metricsByVerificationPhaseNumber(2)).bountyAmount
          .should.eq.BN(90);

        (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.subn(194));
        (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2);
        (await stakeToken.balanceOf(accounts[3])).should.eq.BN(balanceBeforeAccount3);
      });
    });

    describe('stake into second verification phase and greatly surpass resolution criteria', () => {
      before(async () => {
        balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
        balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);
        balanceBeforeAccount3 = await stakeToken.balanceOf(accounts[3]);
      });

      it('should stake successfully and close verification phase', async () => {
        // Stake greatly above resolution criteria on the false status, thus trigger refund of stake overage,
        // close the second verification phase and change resolution engine's verification status
        await oracle.stake(resolutionEngine.address, 2, true, 10, {from: accounts[1]});
        await oracle.stake(resolutionEngine.address, 2, false, 20, {from: accounts[2]});

        (await resolutionEngine.resolutionDeltaAmount(false)).should.eq.BN(150);

        await oracle.stake(resolutionEngine.address, 2, false, 200, {from: accounts[3]});

        (await resolutionEngine.verificationStatus()).should.eq.BN(2);
        (await resolutionEngine.metricsByVerificationPhaseNumber(2)).bountyAwarded
          .should.be.true;
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(2, accounts[1]))
          .trueStakeAmount.should.eq.BN(10);
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(2, accounts[2]))
          .falseStakeAmount.should.eq.BN(20);
        (await resolutionEngine.metricsByVerificationPhaseNumberAndWallet(2, accounts[3]))
          .falseStakeAmount.should.eq.BN(150);

        (await resolutionEngine.verificationPhaseNumber()).should.eq.BN(3);
        (await resolutionEngine.metricsByVerificationPhaseNumber(3)).bountyAmount
          .should.eq.BN(81);

        (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.subn(10));
        (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2.subn(20));
        (await stakeToken.balanceOf(accounts[3])).should.eq.BN(balanceBeforeAccount3.subn(200));
      });
    });

    describe('stage payout', () => {
      it('should stage payout successfully', async () => {
        (await oracle.stagePayout(resolutionEngine.address, 1, 2, {from: accounts[1]}));
        (await oracle.stagePayout(resolutionEngine.address, 1, 2, {from: accounts[2]}));
        (await oracle.stagePayout(resolutionEngine.address, 1, 2, {from: accounts[3]}));

        // Payout staged for accounts[1]:
        // phase1: 195 / 197 * (bounty of 100 + opposite stake of 3) + own stake of 1 + 194
        // phase2: 0
        (await resolutionEngine.stagedAmountByWallet(accounts[1])).should.eq.BN(
          195 / 197 * (100 + 3) + 1 + 194
        );

        // Payout staged for accounts[2]:
        // phase1: 2 / 197 * (bounty of 100 + opposite stake of 3) + own stake of 2
        // phase2: 20 / 170 * (bounty of 90 + opposite stake of 10) + own stake of 20
        (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(
          2 / 197 * (100 + 3) + 2 + 20 / 170 * (90 + 10) + 20
        );

        // Payout staged for accounts[3]:
        // phase1: 0
        // phase2: 150 / 170 * (bounty of 90 + opposite stake of 10) + own stake of 150 + stake overage of 50
        (await resolutionEngine.stagedAmountByWallet(accounts[3])).should.eq.BN(
          150 / 170 * (90 + 10) + 150 + 50
        );
      });
    });

    describe('withdraw', () => {
      let stagedAmountBeforeAccount1, stagedAmountBeforeAccount2, stagedAmountBeforeAccount3;

      before(async () => {
        balanceBeforeAccount1 = await stakeToken.balanceOf(accounts[1]);
        balanceBeforeAccount2 = await stakeToken.balanceOf(accounts[2]);
        balanceBeforeAccount3 = await stakeToken.balanceOf(accounts[3]);

        stagedAmountBeforeAccount1 = await resolutionEngine.stagedAmountByWallet(accounts[1]);
        stagedAmountBeforeAccount2 = await resolutionEngine.stagedAmountByWallet(accounts[2]);
        stagedAmountBeforeAccount3 = await resolutionEngine.stagedAmountByWallet(accounts[3]);
      });

      it('should withdraw successfully', async () => {
        (await oracle.withdraw(resolutionEngine.address, 10, {from: accounts[1]}));
        (await oracle.withdraw(resolutionEngine.address, 10, {from: accounts[2]}));
        (await oracle.withdraw(resolutionEngine.address, 10, {from: accounts[3]}));

        (await resolutionEngine.stagedAmountByWallet(accounts[1])).should.eq.BN(stagedAmountBeforeAccount1.subn(10));
        (await stakeToken.balanceOf(accounts[1])).should.eq.BN(balanceBeforeAccount1.addn(10));

        (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(stagedAmountBeforeAccount2.subn(10));
        (await stakeToken.balanceOf(accounts[2])).should.eq.BN(balanceBeforeAccount2.addn(10));

        (await resolutionEngine.stagedAmountByWallet(accounts[3])).should.eq.BN(stagedAmountBeforeAccount3.subn(10));
        (await stakeToken.balanceOf(accounts[3])).should.eq.BN(balanceBeforeAccount3.addn(10));
      });
    });
  });
});
