/* global artifacts, assert, before, contract, context, it, web3 */
const {
  ACL,
  DAOFactory,
  EVMScriptRegistryFactory,
  Kernel,
  MiniMeToken
} = require('@tps/test-helpers/artifacts')

const Allocations = artifacts.require('Allocations')

const { assertRevert } = require('@tps/test-helpers/assertThrow')
const timetravel = require('@tps/test-helpers/timeTravel')(web3)
const Vault = artifacts.require('Vault')
//const BigNumber = require('bignumber.js')
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'

const failedPayment = receipt =>
  receipt.logs.filter(x => x.event == 'PaymentFailure')[0].args // TODO: not-used

const ANY_ADDR = '0xffffffffffffffffffffffffffffffffffffffff'
const TEM_DAYS = 864000

contract('Allocations App', accounts => {
  let daoFact,
    vaultBase,
    vault = {},
    app = {}

  const root = accounts[0]

  before(async () => {
    const kernelBase = await Kernel.new(true)
    const aclBase = await ACL.new()
    const regFact = await EVMScriptRegistryFactory.new()
    daoFact = await DAOFactory.new(
      kernelBase.address,
      aclBase.address,
      regFact.address
    )
    const r = await daoFact.newDAO(root)
    const dao = await Kernel.at(
      r.logs.filter(l => l.event == 'DeployDAO')[0].args.dao
    )

    const acl = await ACL.at(await dao.acl())

    await acl.createPermission(
      root,
      dao.address,
      await dao.APP_MANAGER_ROLE(),
      root,
      { from: root }
    )

    let receipt = await dao.newAppInstance(
      '0x1234',
      (await Allocations.new()).address,
      '0x',
      false,
      { from: root }
    )

    app = await Allocations.at(
      receipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy
    )

    await acl.createPermission(
      ANY_ADDR,
      app.address,
      await app.CREATE_ACCOUNT_ROLE(),
      root,
      { from: root }
    )
    await acl.createPermission(
      ANY_ADDR,
      app.address,
      await app.CREATE_ALLOCATION_ROLE(),
      root,
      { from: root }
    )
    await acl.createPermission(
      ANY_ADDR,
      app.address,
      await app.EXECUTE_PAYOUT_ROLE(),
      root,
      { from: root }
    )
    await acl.createPermission(
      root,
      app.address,
      await app.EXECUTE_ALLOCATION_ROLE(),
      root,
      { from: root }
    )

    await acl.createPermission(
      root,
      app.address,
      await app.CHANGE_PERIOD_ROLE(),
      root,
      { from: root }
    )

    await acl.createPermission(
      root,
      app.address,
      await app.CHANGE_BUDGETS_ROLE(),
      root,
      { from: root }
    )

    await acl.createPermission(
      root,
      app.address,
      await app.SET_MAX_CANDIDATES_ROLE(),
      root,
      { from: root }
    )

    vaultBase = await Vault.new()
    const receipt1 = await dao.newAppInstance('0x5678', vaultBase.address, '0x', false, { from: root })
    vault = await Vault.at(receipt1.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
    await vault.initialize()
    await acl.createPermission(
      app.address,
      vault.address,
      await vault.TRANSFER_ROLE(),
      root,
      { from: root }
    )
    //Confirm revert if period is less than 1 day
    assertRevert(async () => {
      await app.initialize(vault.address, 86399, { from: accounts[0] })
    })
    await app.initialize(vault.address, 864000, { from: accounts[0] })
  })

  context('app creation and funded Payout', () => {
    const bobafett = accounts[1]
    const dengar = accounts[2]
    const bossk = accounts[3]
    const empire = accounts[4]

    let bobafettInitialBalance,
      dengarInitialBalance,
      bosskInitialBalance,
      empireInitialBalance,
      accountId,
      candidateAddresses,
      deferredPayoutId,
      ethPayoutId,
      supports,
      token,
      totalsupport,
      timestamp,
      zeros

    before(async () => {
      token = await MiniMeToken.new(NULL_ADDRESS, NULL_ADDRESS, 0, 'one', 18, 'one', true) // empty parameters minime
      bobafettInitialBalance = await web3.eth.getBalance(bobafett)
      dengarInitialBalance = await web3.eth.getBalance(dengar)
      bosskInitialBalance = await web3.eth.getBalance(bossk)
      empireInitialBalance = await web3.eth.getBalance(empire)
      candidateAddresses = [ bobafett, dengar, bossk, empire ]
      accountId = (await app.newAccount(
        'Fett\'s vett',
        NULL_ADDRESS,
        true,
        web3.toWei('0.03', 'ether')
      )).logs[0].args.accountId.toNumber()

      await vault.deposit(
        NULL_ADDRESS, // zero address
        web3.toWei('0.1', 'ether'),
        { from: root, value: web3.toWei('0.1', 'ether') }
      )
      supports = [ 500, 200, 300, 0 ]
      totalsupport = 1000
      await token.generateTokens(root, 25e18)
      await token.transfer(vault.address, 25e18)
      zeros = new Array(candidateAddresses.length).fill(0)
      timestamp = (await web3.eth.getBlock('latest')).timestamp
      ethPayoutId = (await app.setDistribution(
        candidateAddresses,
        supports,
        zeros,
        '',
        'ETH description',
        zeros,
        zeros,
        accountId,
        1,
        0x0,
        0x0,
        web3.toWei(0.01, 'ether'),
      )).logs[0].args.payoutId.toNumber()
      deferredPayoutId = (await app.setDistribution(
        candidateAddresses,
        supports,
        zeros,
        '',
        'ETH description',
        zeros,
        zeros,
        accountId,
        2,
        timestamp+10,
        86400,
        web3.toWei(0.01, 'ether'),
      )).logs[0].args.payoutId.toNumber()
    })

    it('app initialized properly', async () => {
      let initBlock = await app.getInitializationBlock()
      assert.isAbove(
        initBlock.toNumber(),
        0,
        'App was not initialized properly'
      )
    })

    it('fail to set distribution - not enough funds', async () => {
      const [ , token ] = await app.getAccount(accountId)
      const amount = (await vault.balance(token)).plus(1).toString()
      return assertRevert(async () => {
        await app.setDistribution(
          candidateAddresses,
          supports,
          zeros,
          '',
          'ETH description',
          zeros,
          zeros,
          accountId,
          1,
          0x0,
          0x0,
          amount,
        )
      })
    })

    it('can create a new Account', async () => {
      const accountMembers = await app.getAccount(accountId)
      assert.equal(accountMembers[0], 'Fett\'s vett', 'Payout metadata incorrect')
    })

    it('fail to get period information due to periodNo being too high', async () => {
      const periodNo = (await app.getCurrentPeriodId()).plus(1).toNumber()
      return assertRevert(async () => {
        await app.getPeriod(periodNo)
      })
    })

    it('can get period information', async () => {
      const periodNo = (await app.getCurrentPeriodId()).toNumber()
      const [
        isCurrent,
        startTime,
        endTime,
      ] = await app.getPeriod(periodNo)
      assert(isCurrent, 'current period is current')
      assert.strictEqual(endTime - startTime, TEM_DAYS - 1, 'should be equal to ten days minus one second')

    })

    it('fail to get the distribution (eth) - idx too high', async () => {
      const candidateArrayLength = (await app.getNumberOfCandidates(
        accountId,
        ethPayoutId
      )).toNumber()

      return assertRevert(async () => {
        await app.getPayoutDistributionValue(accountId, ethPayoutId, candidateArrayLength+1)
      })
    })

    it('gets the distribution (eth)', async () => {
      const candidateArrayLength = (await app.getNumberOfCandidates(
        accountId,
        ethPayoutId
      )).toNumber()
      let storedSupport = []
      let supportVal

      for (let i = 0; i < candidateArrayLength; i++) {
        supportVal = (await app.getPayoutDistributionValue(
          accountId,
          ethPayoutId,
          i
        )).toNumber()
        assert.equal(
          supports[i],
          supportVal,
          'support distributions do not match what is specified'
        )
        storedSupport.push(supportVal)
      }
      assert.equal(
        supports.length,
        storedSupport.length,
        'distribution array lengths do not match'
      )
    })

    it('fails to auto-executes the payout (eth) - accountId too high', async () => {
      return assertRevert(async () => {
        await app.runPayout(accountId+1, ethPayoutId)
      })
    })

    it('fails to auto-executes the payout (eth) - payoutId too high', async () => {
      return assertRevert(async () => {
        await app.runPayout(accountId, ethPayoutId+2)
      })
    })

    it('auto-executes the payout (eth)', async () => {
      let bobafettBalance = await web3.eth.getBalance(bobafett)
      let dengarBalance = await web3.eth.getBalance(dengar)
      let bosskBalance = await web3.eth.getBalance(bossk)
      assert.equal(
        bobafettBalance.toNumber() - bobafettInitialBalance.toNumber(),
        (web3.toWei(0.01, 'ether') * supports[0]) / totalsupport,
        'bobafett expense'
      )
      assert.equal(
        dengarBalance.toNumber() - dengarInitialBalance.toNumber(),
        (web3.toWei(0.01, 'ether') * supports[1]) / totalsupport,
        'dengar expense'
      )
      assert.equal(
        bosskBalance.toNumber() - bosskInitialBalance.toNumber(),
        (web3.toWei(0.01, 'ether') * supports[2]) / totalsupport,
        'bossk expense'
      )
      const tx = await app.runPayout(accountId, ethPayoutId)
      // calling runPayout has no effect
      bobafettBalance = await web3.eth.getBalance(bobafett)
      dengarBalance = await web3.eth.getBalance(dengar)
      bosskBalance = await web3.eth.getBalance(bossk)
      assert.equal(
        bobafettBalance.toNumber() - bobafettInitialBalance.toNumber(),
        (web3.toWei(0.01, 'ether') * supports[0]) / totalsupport,
        'bobafett expense'
      )
      assert.equal(
        dengarBalance.toNumber() - dengarInitialBalance.toNumber(),
        (web3.toWei(0.01, 'ether') * supports[1]) / totalsupport,
        'dengar expense'
      )
      assert.equal(
        bosskBalance.toNumber() - bosskInitialBalance.toNumber(),
        (web3.toWei(0.01, 'ether') * supports[2]) / totalsupport,
        'bossk expense'
      )
    })

    it('fail to execute single payout by root - invalid candidate id', async () => {
      const candidateArrayLength = (await app.getNumberOfCandidates(
        accountId,
        ethPayoutId
      )).toNumber()

      return assertRevert(async () => {
        await app.executePayout(accountId, ethPayoutId, candidateArrayLength+1, { from: root })
      })
    })

    it('fail to execute single payout by root - invalid payout id', async () => {
      return assertRevert(async () => {
        await app.executePayout(accountId, ethPayoutId+2, 0, { from: root })
      })
    })

    it('execute single payout by root', async () => {
      let bobafettBalance = await web3.eth.getBalance(bobafett)
      assert.equal(
        bobafettBalance.toNumber() - bobafettInitialBalance.toNumber(),
        (web3.toWei(0.01, 'ether') * supports[0]) / totalsupport,
        'bobafett expense'
      )
      const candidateId = candidateAddresses.findIndex((candidate) => {
        return candidate === bobafett
      })
      await app.executePayout(accountId, ethPayoutId, candidateId, { from: root })
      //No effect since payout already occured
      bobafettBalance = await web3.eth.getBalance(bobafett)
      assert.equal(
        bobafettBalance.toNumber() - bobafettInitialBalance.toNumber(),
        (web3.toWei(0.01, 'ether') * supports[0]) / totalsupport,
        'bobafett expense'
      )
    })

    it('fail to execute single payout by candidate - invalid payout id', async () => {
      const candidateId = candidateAddresses.findIndex((candidate) => {
        return candidate === empire
      })
      return assertRevert(async () => {
        await app.candidateExecutePayout(accountId, ethPayoutId+2, candidateId, { from: empire })
      })
    })

    it('fail to execute single payout by candidate - wrong candidate', async () => {
      const candidateId = candidateAddresses.findIndex((candidate) => {
        return candidate === bobafett
      })
      return assertRevert(async () => {
        await app.candidateExecutePayout(accountId, ethPayoutId, candidateId, { from: empire })
      })
    })

    it('execute single payout by candidate', async () => {
      let empireBalance = await web3.eth.getBalance(empire)
      //Repay gas costs to empire
      const costs = (empireInitialBalance.toNumber() + ((web3.toWei(0.01, 'ether') * supports[0]) / totalsupport)) - empireBalance.toNumber()
      await web3.eth.sendTransaction({ from:root, to:empire, value:costs })
      empireBalance = await web3.eth.getBalance(empire)
      assert.equal(
        empireBalance.toNumber() - empireInitialBalance.toNumber(),
        (web3.toWei(0.01, 'ether') * supports[0]) / totalsupport,
        'empire expense'
      )
      const candidateId = candidateAddresses.findIndex((candidate) => {
        return candidate === empire
      })
      const gasPrice = 1
      const tx = await app.candidateExecutePayout(accountId, ethPayoutId, candidateId, { from: empire, gasPrice:gasPrice })
      const gas = tx.receipt.gasUsed
      const gasCost = gasPrice * gas
      await web3.eth.sendTransaction({ from:root, to:empire, value:gasCost })
      //No effect
      empireBalance = await web3.eth.getBalance(empire)
      assert.equal(
        empireBalance.toNumber() - empireInitialBalance.toNumber(),
        (web3.toWei(0.01, 'ether') * supports[0]) / totalsupport,
        'empire expense'
      )
    })

    it('retrieves payout info details (eth)', async () => {
      const payoutInfo = await app.getPayout(accountId,ethPayoutId)
      assert.strictEqual(payoutInfo[0].toNumber(), 1e16, 'payout amount incorrect')
      assert.strictEqual(payoutInfo[1].toNumber(), 1, 'payout Should not be recurring')
      assert.strictEqual(payoutInfo[2].toNumber(), 0, 'recurring payout start time incorrect')
      assert.strictEqual(payoutInfo[3].toNumber(), 0, 'recurring payout period length incorrect')
    })

    it('retrieves payout description', async () =>{
      const payoutDescription = await app.getPayoutDescription(accountId,ethPayoutId)
      assert.strictEqual(payoutDescription, 'ETH description', 'Payout description incorrectly stored')
    })

    it('sets the distribution (token)', async () => {
      const candidateArrayLength = (await app.getNumberOfCandidates(
        accountId,
        deferredPayoutId,
      )).toNumber()
      let storedSupport = []
      let supportVal

      for (let i = 0; i < candidateArrayLength; i++) {
        supportVal = (await app.getPayoutDistributionValue(
          accountId,
          deferredPayoutId,
          i
        )).toNumber()
        assert.equal(
          supports[i],
          supportVal,
          'support distributions do not match what is specified'
        )
        storedSupport.push(supportVal)
      }
      assert.equal(
        supports.length,
        storedSupport.length,
        'distribution array lengths do not match'
      )
    })

    it('executes the payout (recurring)', async () => {
      timetravel(2*86400)
      await app.runPayout(accountId, deferredPayoutId)

      const bobafettBalance = await web3.eth.getBalance(bobafett)
      const dengarBalance = await web3.eth.getBalance(dengar)
      const bosskBalance = await web3.eth.getBalance(bossk)

      assert.equal(
        bobafettBalance.toNumber() - bobafettInitialBalance.toNumber(),
        (web3.toWei(0.03, 'ether') * supports[0]) / totalsupport,
        'bobafett expense'
      )
      assert.equal(
        dengarBalance.toNumber() - dengarInitialBalance.toNumber(),
        (web3.toWei(0.03, 'ether') * supports[1]) / totalsupport,
        'dengar expense'
      )
      assert.equal(
        bosskBalance.toNumber() - bosskInitialBalance.toNumber(),
        (web3.toWei(0.03, 'ether') * supports[2]) / totalsupport,
        'bossk expense'
      )
    })

    it('cannot execute more than once if non-recurring', async () => {
      const receipt =  await app.runPayout(accountId, ethPayoutId)
      const firstFailedPayment = failedPayment(receipt)
      assert.equal(accountId, firstFailedPayment.accountId)
      assert.equal(ethPayoutId, firstFailedPayment.payoutId)
      assert.equal(0, firstFailedPayment.candidateId)
    })

    context('invalid workflows', () => {
      before(async () => {
        accountId = (await app.newAccount(
          'Fett\'s vett',
          false,
          0,
          0
        )).logs[0].args.accountId.toNumber()
      })

      it('cannot set Distribution before funding the account (eth)', async () => {
        supports = [ 500, 200, 300 ]
        //const totalsupport = 1000
        const zeros = new Array(candidateAddresses.length).fill(0)
        return assertRevert(async () => {
          await app.setDistribution(
            candidateAddresses,
            supports,
            zeros,
            '',
            '',
            zeros,
            zeros,
            accountId,
            false,
            0,
            web3.toWei(0.01, 'ether'),
            0x0
          )
        })
      })

      it('cannot set Distribution before funding the account (token)', async () => {
        supports = [ 500, 200, 300 ]
        //const totalsupport = 1000
        const zeros = new Array(candidateAddresses.length).fill(0)
        return assertRevert(async () => {
          await app.setDistribution(
            candidateAddresses,
            supports,
            zeros,
            '',
            '',
            zeros,
            zeros,
            accountId,
            false,
            0,
            web3.toWei(26, 'ether'),
            token.address
          )
        })
      })
    })
  })

  context('Recurring Payout', () => {
    const bobafett = accounts[1]
    const dengar = accounts[2]
    const bossk = accounts[3]
    const empire = accounts[4]

    let bobafettInitialBalance,
      dengarInitialBalance,
      bosskInitialBalance,
      accountId,
      candidateAddresses,
      supports

    before(async () => {
      bobafettInitialBalance = await web3.eth.getBalance(bobafett)
      dengarInitialBalance = await web3.eth.getBalance(dengar)
      bosskInitialBalance = await web3.eth.getBalance(bossk)
      candidateAddresses = [ bobafett, dengar, bossk ]
      accountId = (await app.newAccount(
        'Fett\'s vett',
        NULL_ADDRESS,
        0,
        0
      )).logs[0].args.accountId.toNumber()
      await vault.deposit(
        NULL_ADDRESS, // zero address
        web3.toWei('0.02', 'ether'),
        { from: empire, value: web3.toWei('0.02', 'ether') }
      )
    })

    it('cannot occur more frequently than daily', async () => {
      supports = [ 300, 400, 300 ]
      //const totalsupport = 1000
      const zeros = new Array(candidateAddresses.length).fill(0)
      return assertRevert(async () => {
        await app.setDistribution(
          candidateAddresses,
          supports,
          zeros,
          '',
          '',
          zeros,
          zeros,
          accountId,
          2,
          0x0,
          86300,
          web3.toWei(0.01, 'ether'),
          { from: empire, }
        )
      })
    })

    it('will not execute more frequently than the specified period', async () => {
      supports = [ 300, 400, 300 ]
      const totalsupport = 1000

      bobafettInitialBalance = await web3.eth.getBalance(bobafett)
      dengarInitialBalance = await web3.eth.getBalance(dengar)
      bosskInitialBalance = await web3.eth.getBalance(bossk)
      const zeros = new Array(candidateAddresses.length).fill(0)
      const timestamp = (await web3.eth.getBlock('latest')).timestamp
      const payoutId = (await app.setDistribution(
        candidateAddresses,
        supports,
        zeros,
        '',
        '',
        zeros,
        zeros,
        accountId,
        2,
        timestamp,  // Start time must be current time
        86400,
        web3.toWei('0.01', 'ether'),
      )).logs[0].args.payoutId.toNumber()
      await app.runPayout(accountId, payoutId)
      const bobafettBalance = await web3.eth.getBalance(bobafett)
      const dengarBalance = await web3.eth.getBalance(dengar)
      const bosskBalance = await web3.eth.getBalance(bossk)
      assert.equal(
        bobafettBalance.toNumber() - bobafettInitialBalance.toNumber(),
        (web3.toWei(0.01, 'ether') * supports[0]) / totalsupport,
        'bounty hunter expense 1 not paid out'
      )
      assert.equal(
        dengarBalance.toNumber() - dengarInitialBalance.toNumber(),
        (web3.toWei(0.01, 'ether') * supports[1]) / totalsupport,
        'bounty hunter expense 2 not paid out'
      )
      assert.equal(
        bosskBalance.toNumber() - bosskInitialBalance.toNumber(),
        (web3.toWei(0.01, 'ether') * supports[2]) / totalsupport,
        'bounty hunter expense 3 not paid out'
      )
      timetravel(43200)
      const receipt =  await app.runPayout(accountId, payoutId)
      const firstFailedPayment = failedPayment(receipt)
      assert.equal(accountId, firstFailedPayment.accountId)
      assert.equal(payoutId, firstFailedPayment.payoutId)
      assert.equal(0, firstFailedPayment.candidateId)
    })
  })

  context('Update Global State', () => {
    const bobafett = accounts[1]
    const dengar = accounts[2]
    const bossk = accounts[3]
    const empire = accounts[4]

    let accountId,
      candidateAddresses,
      supports,
      zeros

    before(async () => {
      supports = [ 500, 200, 300 ]
      candidateAddresses = [ bobafett, dengar, bossk ]
      zeros = new Array(candidateAddresses.length).fill(0)
      accountId = (await app.newAccount(
        'Fett\'s vett',
        NULL_ADDRESS,
        0,
        0
      )).logs[0].args.accountId.toNumber()
      await vault.deposit(
        NULL_ADDRESS, // zero address
        web3.toWei('0.02', 'ether'),
        { from: empire, value: web3.toWei('0.02', 'ether') }
      )
    })

    it('should fail to set period duration - below minimum period', async () => {
      return assertRevert(async () => {
        await app.setPeriodDuration(86399, { from: root })
      })
    })

    it('should set period duraton', async () => {
      await app.setPeriodDuration(86400, { from: root })
      //Unable to check periodDuration since it's not public
    })

    it('should set the max candidates to zero and fail to set distribution', async () => {
      await app.setMaxCandidates(0, { from: root })
      return assertRevert(async () => {
        await app.setDistribution(
          candidateAddresses,
          supports,
          zeros,
          '',
          'ETH description',
          zeros,
          zeros,
          accountId,
          1,
          0x0,
          0x0,
          web3.toWei('0.01', 'ether'))
      })
    })

    it('should reset max candidates', async () => {
      await app.setMaxCandidates(50, { from: root })
    })

    it('should set budget for accountId', async () => {
      await app.setBudget(accountId, 1000)
      const [ , , , budget ] = await app.getAccount(accountId)
      assert.equal(1000, budget.toNumber())
    })

    it('should set budget without setting account.hasBudget', async () => {
      await app.setBudget(accountId, 0)
      const [ , , , budget ] = await app.getAccount(accountId)
      assert.equal(0, budget.toNumber())
    })

    it('should advance period', async () => {
      timetravel(864000)
      await app.advancePeriod(1)
    })

    it('should run out of funds', async () => {
      const balance = await vault.balance(NULL_ADDRESS)
      const amount = balance.minus(1).toString()

      const timestamp = (await web3.eth.getBlock('latest')).timestamp+86400
      const payoutId1 = (await app.setDistribution(
        candidateAddresses,
        supports,
        zeros,
        '',
        '',
        zeros,
        zeros,
        accountId,
        1,
        timestamp,  // Start time must be current time
        0,
        amount,
      )).logs[0].args.payoutId.toNumber()
      const payoutId2 = (await app.setDistribution(
        candidateAddresses,
        supports,
        zeros,
        '',
        '',
        zeros,
        zeros,
        accountId,
        1,
        timestamp,  // Start time must be current time
        0,
        amount,
      )).logs[0].args.payoutId.toNumber()
      timetravel(86400)
      await app.runPayout(accountId, payoutId1)
      await app.runPayout(accountId, payoutId2)
    })

    it('should remove budget', async () => {
      await app.removeBudget(accountId)
      const [ , , hasBudget ] = await app.getAccount(accountId)
      assert.equal(false, hasBudget)
    })
    /*
    it('overflow', async () => {
      const max64 = BigNumber('18446744073709551616')
      const periodDuration = 864000000000000000
      await app.setPeriodDuration(periodDuration, { from: root })
      //await app.setPeriodDuration(max64.toString(), { from: root })
      let timestamp = (await web3.eth.getBlock('latest')).timestamp
      console.log(timestamp)
      const timechange = max64.minus(timestamp)
      const periods = parseInt(timechange.dividedBy(periodDuration).toNumber())
      console.log(timechange.toString())
      console.log(periods)
      timetravel(timechange.toString())
      timestamp = (await web3.eth.getBlock('latest')).timestamp
      console.log(timestamp)

      await app.advancePeriod(periods)
      //await app.executePayout(accountId, 1, 0, {from: root})
    })
*/
  })
})
