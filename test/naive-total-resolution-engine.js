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
const {Wallet, providers, constants: {AddressZero}} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const StakeToken = artifacts.require('StakeToken');
const NaiveTotalResolutionEngine = artifacts.require('NaiveTotalResolutionEngine');
const MockedBountyFund = artifacts.require('MockedBountyFund');
const MockedAllocator = artifacts.require('MockedAllocator');

contract('NaiveTotalResolutionEngine', (accounts) => {
  let ownerAddress, operatorAddress, oracleAddress;
  let provider;
  let stakeToken, resolutionEngine, bountyFund, bountyAllocator;
  let ownerRole;

  beforeEach(async () => {
    ownerAddress = accounts[0];
    operatorAddress = accounts[0];
    oracleAddress = accounts[1];

    provider = (new providers.Web3Provider(web3.currentProvider)).getSigner(ownerAddress).provider;

    stakeToken = await StakeToken.new('Lottery Oracle Token', 'LOT', 15);

    bountyFund = await MockedBountyFund.new();
    await bountyFund._setToken(stakeToken.address);
    await bountyFund._setAllocation(10);

    await stakeToken.mint(bountyFund.address, 100);

    bountyAllocator = await MockedAllocator.new();

    resolutionEngine = await NaiveTotalResolutionEngine.new(
      oracleAddress, operatorAddress, bountyFund.address, 100
    );
    await resolutionEngine.setBountyAllocator(bountyAllocator.address);
    await resolutionEngine.initialize();

    ownerRole = await resolutionEngine.OWNER_ROLE();
  });

  describe('constructor()', () => {
    beforeEach(async () => {
      resolutionEngine = await NaiveTotalResolutionEngine.new(
        oracleAddress, operatorAddress, bountyFund.address, 100
      );
    });

    it('should successfully initialize', async () => {
      (await resolutionEngine.isRole(ownerRole)).should.be.true;
      (await resolutionEngine.isRoleAccessor(ownerRole, ownerAddress)).should.be.true;
      (await resolutionEngine.isRoleAccessor(ownerRole, oracleAddress)).should.be.false;

      (await resolutionEngine.oracle()).should.equal(oracleAddress);
      (await resolutionEngine.operator()).should.equal(operatorAddress);
      (await resolutionEngine.bountyFund()).should.equal(bountyFund.address);
      (await resolutionEngine.frozen()).should.be.false;

      (await resolutionEngine.verificationPhaseNumber()).should.be.eq.BN(0);

      (await bountyFund.resolutionEngine()).should.equal(resolutionEngine.address);
    });
  });

  describe('freeze()', () => {
    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await resolutionEngine.freeze({from: accounts[2]})
          .should.be.rejected;
      });
    });

    describe('if called by owner', () => {
      it('should successfully freeze', async () => {
        const result = await resolutionEngine.freeze();

        result.logs[0].event.should.equal('Frozen');

        (await resolutionEngine.frozen()).should.be.true;
      });
    });
  });

  describe('setBountyAllocator()', () => {
    let bountyAllocator;

    before(() => {
      bountyAllocator = Wallet.createRandom().address;
    });

    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await resolutionEngine.setBountyAllocator(bountyAllocator, {from: accounts[2]})
          .should.be.rejected;
      });
    });

    describe('if called by owner', () => {
      it('should successfully set the bounty allocator', async () => {
        const result = await resolutionEngine.setBountyAllocator(bountyAllocator);

        result.logs[0].event.should.equal('BountyAllocatorSet');

        (await resolutionEngine.bountyAllocator()).should.equal(bountyAllocator);
      });
    });
  });

  describe('initialize()', () => {
    beforeEach(async () => {
      resolutionEngine = await NaiveTotalResolutionEngine.new(
        oracleAddress, operatorAddress, bountyFund.address, 100
      );
      await resolutionEngine.setBountyAllocator(bountyAllocator.address);
    });

    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await resolutionEngine.initialize({from: accounts[2]})
          .should.be.rejected;
      });
    });

    describe('if bounty allocator is zero-address', () => {
      beforeEach(async () => {
        await resolutionEngine.setBountyAllocator(AddressZero);
      });

      it('should revert', async () => {
        await resolutionEngine.initialize()
          .should.be.rejected;
      });
    });

    describe('if called by owner', () => {
      it('should successfully initialize', async () => {
        const result = await resolutionEngine.initialize();

        result.logs.map(l => l.event).should.include('Initialized');

        (await resolutionEngine.verificationPhaseNumber()).should.be.eq.BN(1);
        (await resolutionEngine.verificationPhaseByPhaseNumber(1)).bountyAmount.should.be.eq.BN(10);
        (await bountyFund._tokenAllocatee()).should.equal(resolutionEngine.address);
      });
    });

    describe('if already initialized', () => {
      beforeEach(async () => {
        await resolutionEngine.initialize();
      });

      it('should revert', async () => {
        await resolutionEngine.initialize({from: accounts[2]})
          .should.be.rejected;
      });
    });
  });

  describe('disable()', () => {
    describe('if called by non-operator', () => {
      it('should revert', async () => {
        await resolutionEngine.disable('some action', {from: oracleAddress})
          .should.be.rejected;
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
        await resolutionEngine.disable('some action')
          .should.be.rejected;
      });
    });
  });

  describe('enable()', () => {
    describe('if called by non-operator', () => {
      it('should revert', async () => {
        await resolutionEngine.enable('some action', {from: oracleAddress})
          .should.be.rejected;
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
        await resolutionEngine.enable('some action')
          .should.be.rejected;
      });
    });
  });

  describe('stake()', () => {
    describe('if called by non-oracle', () => {
      it('should revert', async () => {
        await resolutionEngine.stake(accounts[2], true, 100, {from: accounts[2]})
          .should.be.rejected;
      });
    });

    describe('if stake action disabled', () => {
      beforeEach(async () => {
        await resolutionEngine.disable(await resolutionEngine.STAKE_ACTION());
      });

      it('should revert', async () => {
        await resolutionEngine.stake(accounts[2], true, 100, {from: oracleAddress})
          .should.be.rejected;
      });
    });

    describe('if called by oracle', () => {
      it('should successfully update metrics', async () => {
        const result = await resolutionEngine.stake(accounts[2], true, 100, {from: oracleAddress});
        result.logs[0].event.should.equal('Staked');
      });
    });
  });

  describe('resolutionDeltaAmount()', () => {
    beforeEach(async () => {
      await resolutionEngine.stake(accounts[2], true, 10, {from: oracleAddress});
      await resolutionEngine.stake(accounts[3], false, 20, {from: oracleAddress});
    });

    it('should return the calculated delta amount', async () => {
      (await resolutionEngine.resolutionDeltaAmount(true)).should.eq.BN(90);
      (await resolutionEngine.resolutionDeltaAmount(false)).should.eq.BN(80);
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
        await resolutionEngine.resolveIfCriteriaMet({from: accounts[2]})
          .should.be.rejected;
      });
    });

    describe('if resolve action is disabled', () => {
      beforeEach(async () => {
        await resolutionEngine.disable(await resolutionEngine.RESOLVE_ACTION());
      });

      it('should revert', async () => {
        await resolutionEngine.resolveIfCriteriaMet({from: oracleAddress})
          .should.be.rejected;
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
        (await resolutionEngine.calculatePayout(Wallet.createRandom().address, 0, 0))
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

      it('should return sum of bounty award and stake', async () => {
        (await resolutionEngine.calculatePayout(accounts[2], 1, 1))
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

      it('should return stake', async () => {
        (await resolutionEngine.calculatePayout(accounts[2], 2, 2))
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
        await resolutionEngine.stagePayout(accounts[2], 0, 0, {from: accounts[2]})
          .should.be.rejected;
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
        await resolutionEngine.stageStake(accounts[2], {from: accounts[2]})
          .should.be.rejected;
      });
    });

    describe('if called when resolve action is enabled', () => {
      it('should revert', async () => {
        await resolutionEngine.stageStake(accounts[2], {from: oracleAddress})
          .should.be.rejected;
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
        await resolutionEngine.stage(accounts[2], 100, {from: accounts[2]})
          .should.be.rejected;
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
        await resolutionEngine.withdraw(accounts[2], 100, {from: accounts[2]})
          .should.be.rejected;
      });
    });

    describe('if called with amount greater than staged amount', () => {
      it('should revert', async () => {
        (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(0);

        await resolutionEngine.withdraw(accounts[2], 100, {from: oracleAddress})
          .should.be.rejected;
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
    describe('if called by non-operator', () => {
      it('should revert', async () => {
        await resolutionEngine.stageBounty(accounts[2], {from: oracleAddress})
          .should.be.rejected;
      });
    });

    describe('if called on enabled resolution engine', () => {
      it('should revert', async () => {
        await resolutionEngine.stageBounty(accounts[2])
          .should.be.rejected;
      });
    });

    describe('if called by operator on disabled resolution engine', () => {
      let bountyAmount;

      beforeEach(async () => {
        bountyAmount = (await resolutionEngine.metricsByVerificationPhaseNumber(
          await resolutionEngine.verificationPhaseNumber()
        )).bountyAmount;

        await resolutionEngine.disable(await resolutionEngine.RESOLVE_ACTION());
      });

      it('should successfully stage the bounty', async () => {
        const result = await resolutionEngine.stageBounty(accounts[2]);
        result.logs[0].event.should.equal('BountyStaged');
        (await resolutionEngine.stagedAmountByWallet(accounts[2])).should.eq.BN(bountyAmount);
      });
    });
  });

  describe('setNextAmount()', () => {
    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await resolutionEngine.setNextAmount(10, {from: accounts[2]})
          .should.be.rejected;
      });
    });

    describe('if called after freeze', () => {
      beforeEach(async () => {
        await resolutionEngine.freeze();
      });

      it('should revert', async () => {
        await resolutionEngine.setNextAmount(10)
          .should.be.rejected;
      });
    });

    describe('if called by owner', () => {
      it('should successfully set the next amount', async () => {
        const result = await resolutionEngine.setNextAmount(10);

        result.logs[0].event.should.equal('NextAmountSet');

        (await resolutionEngine.nextAmount()).should.eq.BN(10);
      });
    });
  });
});
