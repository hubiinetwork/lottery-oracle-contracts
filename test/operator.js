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
const {Wallet, providers} = require('ethers');

chai.use(chaiAsPromised);
chai.use(bnChai(BN));
chai.should();

const Operator = artifacts.require('Operator');
const MockedResolutionEngine = artifacts.require('MockedResolutionEngine');
const MockedBountyFund = artifacts.require('MockedBountyFund');

contract('Operator', (accounts) => {
  let provider, operator, mockedResolutionEngine, mockedBountyFund;

  beforeEach(async () => {
    provider = (new providers.Web3Provider(web3.currentProvider)).getSigner(accounts[0]).provider;

    mockedResolutionEngine = await MockedResolutionEngine.new();

    mockedBountyFund = await MockedBountyFund.new();
    await mockedBountyFund.setResolutionEngine(mockedResolutionEngine.address);

    operator = await Operator.new(2);
  });

  describe('constructor()', () => {
    it('should successfully initialize', async () => {
      operator.address.should.have.lengthOf(42);
      const ownerRole = await operator.OWNER_ROLE();
      (await operator.isRoleAccessor(ownerRole, accounts[0])).should.be.true;
      (await operator.isRoleAccessor(ownerRole, accounts[1])).should.be.false;
      (await operator.frozen()).should.be.false;
    });
  });

  describe('freeze()', () => {
    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await operator.freeze({from: accounts[2]})
          .should.be.rejected;
      });
    });

    describe('if called by owner', () => {
      it('should successfully freeze', async () => {
        const result = await operator.freeze();

        result.logs[0].event.should.equal('Frozen');

        (await operator.frozen()).should.be.true;
      });
    });
  });

  describe('startDisablementTimer()', () => {
    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await operator.startDisablementTimer(
          Wallet.createRandom().address, 10, {from: accounts[1]}
        ).should.be.rejected;
      });
    });

    describe('if called by with timeout param less than the minimum', () => {
      it('should revert', async () => {
        await operator.startDisablementTimer(
          Wallet.createRandom().address, 1, {from: accounts[0]}
        ).should.be.rejected;
      });
    });

    describe('if called by with timeout param greater than or equal to the minimum', () => {
      it('should successfully start the disablement timer and disable staking', async () => {
        const result = await operator.startDisablementTimer(
          mockedResolutionEngine.address, 2
        );

        result.logs[0].event.should.equal('DisablementTimerStarted');

        (await mockedResolutionEngine._disabledAction()).should.equal(
          await mockedResolutionEngine.STAKE_ACTION()
        );

        const blockTimestamp = (await provider.getBlock(await provider.getBlockNumber())).timestamp;
        (await operator.disablementTimeoutByResolutionEngine(
          mockedResolutionEngine.address
        )).should.eq.BN(blockTimestamp + 2);
      });
    });
  });

  describe('stopDisablementTimer()', () => {
    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await operator.stopDisablementTimer(
          Wallet.createRandom().address, {from: accounts[1]}
        ).should.be.rejected;
      });
    });

    describe('if called by with timeout param less than the minimum', () => {
      it('should revert', async () => {
        await operator.stopDisablementTimer(
          Wallet.createRandom().address, {from: accounts[0]}
        ).should.be.rejected;
      });
    });

    describe('if called by with timeout param greater than or equal to the minimum', () => {
      it('should successfully start the disablement timer and disable staking', async () => {
        const result = await operator.stopDisablementTimer(
          mockedResolutionEngine.address
        );

        result.logs[0].event.should.equal('DisablementTimerStopped');

        (await mockedResolutionEngine._enabledAction()).should.equal(
          await mockedResolutionEngine.STAKE_ACTION()
        );

        (await operator.disablementTimeoutByResolutionEngine(
          mockedResolutionEngine.address
        )).should.eq.BN(0);
      });
    });
  });

  describe('isDisablementTimerExpired()', () => {
    beforeEach(async () => {
      await operator.startDisablementTimer(mockedResolutionEngine.address, 2);
    });

    describe('if called before disablement timer has expired', () => {
      it('should return false', async () => {
        (await operator.isDisablementTimerExpired(mockedResolutionEngine.address))
          .should.be.false;
      });
    });

    describe('if called after disablement timer has expired', () => {
      beforeEach(async () => {
        // TODO Factor this fast forward out into separate function in ./helpers.js
        await provider.send('evm_increaseTime', [3]);
        await provider.send('evm_mine');
      });

      it('should return true', async () => {
        (await operator.isDisablementTimerExpired(mockedResolutionEngine.address))
          .should.be.true;
      });
    });
  });

  describe('disable()', () => {
    beforeEach(async () => {
      await operator.startDisablementTimer(mockedResolutionEngine.address, 2);
    });

    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await operator.disable(mockedResolutionEngine.address, {from: accounts[1]})
          .should.be.rejected;
      });
    });

    describe('if called before disablement timer has expired', () => {
      it('should revert', async () => {
        await operator.disable(mockedResolutionEngine.address)
          .should.be.rejected;
      });
    });

    describe('if called after disablement timer has expired', () => {
      beforeEach(async () => {
        // TODO Factor this fast forward out into separate function in ./helpers.js
        await provider.send('evm_increaseTime', [3]);
        await provider.send('evm_mine');
      });

      it('should successfully tear down the resolution engine', async () => {
        const result = await operator.disable(mockedResolutionEngine.address);

        result.logs[0].event.should.equal('Disabled');

        (await mockedResolutionEngine._disabledAction()).should.equal(
          await mockedResolutionEngine.RESOLVE_ACTION()
        );
      });
    });
  });

  describe('withdrawAllocatedBounty()', () => {
    let wallet;

    beforeEach(() => {
      wallet = Wallet.createRandom().address;
    });

    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await operator.withdrawAllocatedBounty(mockedResolutionEngine.address, wallet, {from: accounts[1]})
          .should.be.rejected;
      });
    });

    describe('if called by owner', () => {
      it('should successfully stage bounty', async () => {
        const result = await operator.withdrawAllocatedBounty(mockedResolutionEngine.address, wallet);

        result.logs[0].event.should.equal('AllocatedBountyWithdrawn');

        (await mockedResolutionEngine._withdrawBountyWallet()).should.equal(wallet);
      });
    });
  });

  describe('withdrawUnallocatedBounty()', () => {
    let wallet;

    beforeEach(() => {
      wallet = Wallet.createRandom().address;
    });

    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await operator.withdrawUnallocatedBounty(mockedResolutionEngine.address, wallet, {from: accounts[1]})
          .should.be.rejected;
      });
    });

    describe('if resolve action of resolution engine is not disabled', () => {
      it('should revert', async () => {
        await operator.withdrawUnallocatedBounty(mockedResolutionEngine.address, wallet)
          .should.be.rejected;
      });
    });

    describe('if called by owner and resolution engine is disabled', () => {
      beforeEach(async () => {
        await mockedResolutionEngine._setDisabled(true);
      });

      it('should successfully stage bounty', async () => {
        const result = await operator.withdrawUnallocatedBounty(mockedBountyFund.address, wallet);

        result.logs[0].event.should.equal('UnallocatedBountyWithdrawn');

        (await mockedBountyFund._withdrawWallet()).should.equal(wallet);
      });
    });
  });

  describe('setMinimumTimeout()', () => {
    describe('if called by non-owner', () => {
      it('should revert', async () => {
        await operator.setMinimumTimeout(10, {from: accounts[2]})
          .should.be.rejected;
      });
    });

    describe('if called after freeze', () => {
      beforeEach(async () => {
        await operator.freeze();
      });

      it('should revert', async () => {
        await operator.setMinimumTimeout(10)
          .should.be.rejected;
      });
    });

    describe('if called by owner', () => {
      it('should successfully set the minimum timeout', async () => {
        const result = await operator.setMinimumTimeout(10);

        result.logs[0].event.should.equal('MinimumTimeoutSet');

        (await operator.minimumTimeout()).should.eq.BN(10);
      });
    });
  });
});
