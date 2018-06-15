const helpers = require("./helpers")

const Escrow = artifacts.require("./Escrow.sol")
const BigNumber = web3.BigNumber
const should = require('chai')
      .use(require('chai-as-promised'))
      .use(require('chai-bignumber')(BigNumber))
      .should()


contract("Escrow", ([owner, client]) => {
  // refund periods (days):
  const p1len = 30,
        p2len = 14,
        p3len = 7
  
  const expiry = 40 // expire in 40 days

  // refund percentages:

  const p1refund = 100, // before period 1
        p2refund = 50,
        p3refund = 25,
        p4refund = 0    // after period 3

  const paymentAmount = new BigNumber(1e18) // 1 ETH

  const dayInSecs = 86400

  
  let escrow
  
  
  beforeEach("init", async () => {
    return Escrow.new(
      paymentAmount,
      p1len*dayInSecs,
      p2len*dayInSecs,
      p3len*dayInSecs,
      p1refund,
      p2refund,
      p3refund,
      p4refund,
      helpers.getBlockNow() + expiry*dayInSecs
    ).then((contract) => {
      escrow = contract
    })
  })

  it("has an address", async () => {
    (escrow.address.length).should.equal(42)
  })

  it("has a recepient same as owner", async () => {
    (await escrow.recepient()).should.equal(owner)
  })

  it("rejects incorrect paid amount", async()=>{
    let value = new BigNumber(5e17)

    value.should.not.be.bignumber.equal(paymentAmount)
    
    try{
      await escrow.sendTransaction({from: client, value})
      assert.fail()
    } catch (e) {
      helpers.assertRevert(e)
    }
  })

  it("accepts correct paid amount", async () => {
    web3.eth.getBalance(escrow.address).toNumber().should.be.equal(0)

    await escrow.sendTransaction({from: client, value: paymentAmount})

    web3.eth.getBalance(escrow.address).should.be.bignumber.equal(paymentAmount)
  })

  it("emits Paid event", (done)=>{
    escrow.Paid((err,res)=>{
      done(err)
    })

    escrow.sendTransaction({from: client, value: paymentAmount, gasPrice:0})
  })


  describe("once paid",()=>{
    let ownerBal, clientBal
    
    beforeEach("make payment", async()=>{
      await escrow.sendTransaction({from: client, value: paymentAmount, gasPrice:0})
      
      ownerBal = web3.eth.getBalance(owner)
      clientBal = web3.eth.getBalance(client)
    })
    
    it("cannot be paid twice", async()=>{
      try{
        await escrow.sendTransaction({from: client, value: paymentAmount})
        assert.fail()
      } catch (e) {
        helpers.assertRevert(e)
      }
    })
    
    it("can be released by the sender", async()=>{
      await escrow.release({from: client})

      web3.eth.getBalance(escrow.address).toNumber().should.be.equal(0)
      web3.eth.getBalance(owner).should.be.bignumber.equal(ownerBal.add(paymentAmount))
      
      web3.eth.getCode(escrow.address).should.equal("0x0");//checking that it's suicided
    })
    
    it("can't be claimed before it expires", async()=>{
      try{
        await escrow.claim({from: owner})
        assert.fail()
      } catch (e) {
        helpers.assertRevert(e)
      }
    })

    it("can be claimed after it expired", async()=>{
      await helpers.timer(expiry*dayInSecs+1)

      await escrow.claim({from: owner,gasPrice:0})

      web3.eth.getBalance(escrow.address).toNumber().should.be.equal(0)
      web3.eth.getBalance(owner).should.be.bignumber.equal(ownerBal.add(paymentAmount))
    })

    it("can be refunded, period 1", async()=>{
      await escrow.refund({from:client,gasPrice:0})

      web3.eth.getBalance(owner).should.be.bignumber.equal(ownerBal)
      web3.eth.getBalance(client).should.be.bignumber.equal(clientBal.add(paymentAmount))
    })
    
    it("can be refunded, period 2", async()=>{
      await helpers.timer(dayInSecs*(expiry-p1len)+1)

      await escrow.refund({from:client,gasPrice:0})

      web3.eth.getBalance(owner).should.be.bignumber.equal(ownerBal.add(paymentAmount*(100-p2refund)/100))
      web3.eth.getBalance(client).should.be.bignumber.equal(clientBal.add(paymentAmount*p2refund/100))
    })
    it("can be refunded, period 3", async()=>{
      await helpers.timer(dayInSecs*(expiry-p2len)+1)

      await escrow.refund({from:client,gasPrice:0})

      web3.eth.getBalance(owner).should.be.bignumber.equal(ownerBal.add(paymentAmount*(100-p3refund)/100))
      web3.eth.getBalance(client).should.be.bignumber.equal(clientBal.add(paymentAmount*p3refund/100))
    })
    it("can be refunded, period 4", async()=>{
      await helpers.timer(dayInSecs*(expiry-p3len)+1)

      await escrow.refund({from:client,gasPrice:0})

      web3.eth.getBalance(owner).should.be.bignumber.equal(ownerBal.add(paymentAmount*(100-p4refund)/100))
      web3.eth.getBalance(client).should.be.bignumber.equal(clientBal.add(paymentAmount*p4refund/100))
    })

    it("can be cancelled by the recepient, returning full balance to the client", async()=>{
      await escrow.cancel({from:owner})

      web3.eth.getBalance(client).should.be.bignumber.equal(clientBal.add(paymentAmount))
    })
  })
  
})
