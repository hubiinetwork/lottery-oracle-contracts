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
const {Wallet, constants: {AddressZero}} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const Oracle = artifacts.require('Oracle');
const StakeToken = artifacts.require('StakeToken');
const MockedResolutionEngine = artifacts.require('MockedResolutionEngine');

contract('Oracle', (accounts) => {
  let oracle, stakeToken;

  beforeEach(async () => {
    oracle = await Oracle.new();
    stakeToken = await StakeToken.new('Lottery Oracle Token', 'LOT', 15);
  });

  describe('constructor()', () => {
    it('should successfully initialize', async () => {
      oracle.address.should.have.lengthOf(42);
      const ownerRole = await oracle.OWNER_ROLE();
      (await oracle.isRoleAccessor(ownerRole, accounts[0])).should.be.true;
      (await oracle.isRoleAccessor(ownerRole, accounts[1])).should.be.false;
    });
  });

  describe('hasResolutionEngine()', () => {
    it('should successfully return initial value', async () => {
      (await oracle.hasResolutionEngine(Wallet.createRandom().address)).should.be.false;
    });
  });

  describe('resolutionEnginesCount()', () => {
    it('should successfully return initial value', async () => {
      (await oracle.resolutionEnginesCount()).should.eq.BN(0);
    });
  });

  describe('addResolutionEngine()', () => {
    let engineAddress;

    beforeEach(() => {
      engineAddress = Wallet.createRandom().address;
    });

    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await oracle.addResolutionEngine(engineAddress, {from: accounts[1]})
          .should.be.rejected;
      });
    });

    describe('if called by owner', () => {
      it('should successfully add resolution engine', async () => {
        const result = await oracle.addResolutionEngine(engineAddress);
        result.logs[0].event.should.equal('ResolutionEngineAdded');
        (await oracle.hasResolutionEngine(engineAddress)).should.be.true;
        (await oracle.resolutionEnginesCount()).should.eq.BN(1);
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
        await oracle.removeResolutionEngine(engineAddress1, {from: accounts[1]})
          .should.be.rejected;
      });
    });

    describe('if called by owner', () => {
      let resolutionEnginesCount;

      describe('if removing the last address stored', () => {
        beforeEach(async () => {
          await oracle.addResolutionEngine(engineAddress1);
          resolutionEnginesCount = await oracle.resolutionEnginesCount();
        });

        it('should successfully remove resolution engine', async () => {
          const result = await oracle.removeResolutionEngine(engineAddress1);
          result.logs[0].event.should.equal('ResolutionEngineRemoved');
          (await oracle.hasResolutionEngine(engineAddress1)).should.be.false;
          (await oracle.resolutionEnginesCount()).should.eq.BN(resolutionEnginesCount.subn(1));
        });
      });

      describe('if removing not the last address stored', () => {
        let engineAddress2;

        beforeEach(async () => {
          engineAddress2 = Wallet.createRandom().address;

          await oracle.addResolutionEngine(engineAddress1);
          await oracle.addResolutionEngine(engineAddress2);
          resolutionEnginesCount = await oracle.resolutionEnginesCount();
        });

        it('should successfully remove resolution engine', async () => {
          const result = await oracle.removeResolutionEngine(engineAddress1);
          result.logs[0].event.should.equal('ResolutionEngineRemoved');
          (await oracle.hasResolutionEngine(engineAddress1)).should.be.false;
          (await oracle.resolutionEnginesCount()).should.eq.BN(resolutionEnginesCount.subn(1));
        });
      });
    });
  });

  describe('stake()', () => {
    let mockedResolutionEngine;

    beforeEach(async () => {
      mockedResolutionEngine = await MockedResolutionEngine.new();
      await mockedResolutionEngine._setToken(stakeToken.address);

      await oracle.addResolutionEngine(mockedResolutionEngine.address);
    });

    describe('if called on non-registered resolution engine', () => {
      it('should revert', async () => {
        await oracle.stake(Wallet.createRandom().address, 0, true, 100, {from: accounts[1]})
          .should.be.rejected;
      });
    });

    describe('if called with wrong verification phase number', () => {
      it('should revert', async () => {
        await oracle.stake(Wallet.createRandom().address, 1, true, 100, {from: accounts[1]})
          .should.be.rejected;
      });
    });

    describe('if called with amount greater than resolution delta amount', () => {
      beforeEach(async () => {
        await stakeToken.mint(accounts[1], 100);
        await stakeToken.approve(oracle.address, 100, {from: accounts[1]});

        await mockedResolutionEngine._setResolutionDeltaAmount(60);
      });

      it('should successfully stake tokens and stage refund', async () => {
        const result = await oracle.stake(mockedResolutionEngine.address, 0, true, 100, {from: accounts[1]});

        result.logs[0].event.should.equal('TokensStaked');

        (await mockedResolutionEngine._stageCall()).wallet.should.equal(accounts[1]);
        (await mockedResolutionEngine._stageCall()).amount.should.eq.BN(40);

        (await mockedResolutionEngine._stakeCall()).wallet.should.equal(accounts[1]);
        (await mockedResolutionEngine._stakeCall()).status.should.be.true;
        (await mockedResolutionEngine._stakeCall()).amount.should.eq.BN(60);

        (await mockedResolutionEngine._resolveIfCriteriaMetCalled()).should.be.true;

        // Stake only, i.e. no bounty with mocked resolution engine
        (await stakeToken.balanceOf(mockedResolutionEngine.address)).should.eq.BN(100);
      });
    });

    describe('if called with amount smaller than resolution delta amount', () => {
      beforeEach(async () => {
        await stakeToken.mint(accounts[1], 100);
        await stakeToken.approve(oracle.address, 100, {from: accounts[1]});

        await mockedResolutionEngine._setResolutionDeltaAmount(110);
      });

      it('should successfully stake tokens and not stage refund', async () => {
        const result = await oracle.stake(mockedResolutionEngine.address, 0, true, 100, {from: accounts[1]});

        result.logs[0].event.should.equal('TokensStaked');

        (await mockedResolutionEngine._stageCall()).wallet.should.equal(AddressZero);
        (await mockedResolutionEngine._stageCall()).amount.should.eq.BN(0);

        (await mockedResolutionEngine._stakeCall()).wallet.should.equal(accounts[1]);
        (await mockedResolutionEngine._stakeCall()).status.should.be.true;
        (await mockedResolutionEngine._stakeCall()).amount.should.eq.BN(100);

        (await mockedResolutionEngine._resolveIfCriteriaMetCalled()).should.be.true;

        // Stake only, i.e. no bounty with mocked resolution engine
        (await stakeToken.balanceOf(mockedResolutionEngine.address)).should.eq.BN(100);
      });
    });
  });

  describe('stageStake()', () => {
    let mockedResolutionEngine;

    beforeEach(async () => {
      mockedResolutionEngine = await MockedResolutionEngine.new();

      await oracle.addResolutionEngine(mockedResolutionEngine.address);
    });

    it('should successfully stage payout', async () => {
      const result = await oracle.stageStake(mockedResolutionEngine.address, {from: accounts[1]});

      result.logs[0].event.should.equal('StakeStaged');

      (await mockedResolutionEngine._stageStakeWallet()).should.equal(accounts[1]);
    });
  });

  describe('stagePayout()', () => {
    let mockedResolutionEngine;

    beforeEach(async () => {
      mockedResolutionEngine = await MockedResolutionEngine.new();

      await oracle.addResolutionEngine(mockedResolutionEngine.address);
    });

    it('should successfully stage payout', async () => {
      const result = await oracle.stagePayout(mockedResolutionEngine.address, 0, 10, {from: accounts[1]});

      result.logs[0].event.should.equal('PayoutStaged');

      (await mockedResolutionEngine._stagePayoutCall()).wallet.should.equal(accounts[1]);
      (await mockedResolutionEngine._stagePayoutCall()).firstVerificationPhaseNumber.should.eq.BN(0);
      (await mockedResolutionEngine._stagePayoutCall()).lastVerificationPhaseNumber.should.eq.BN(10);
    });
  });

  describe('withdraw()', () => {
    let mockedResolutionEngine;

    beforeEach(async () => {
      mockedResolutionEngine = await MockedResolutionEngine.new();

      await oracle.addResolutionEngine(mockedResolutionEngine.address);
    });

    it('should successfully withdraw', async () => {
      const result = await oracle.withdraw(mockedResolutionEngine.address, 10, {from: accounts[1]});

      result.logs[0].event.should.equal('Withdrawn');

      (await mockedResolutionEngine._withdrawCall()).wallet.should.equal(accounts[1]);
      (await mockedResolutionEngine._withdrawCall()).amount.should.eq.BN(10);
    });
  });
});
