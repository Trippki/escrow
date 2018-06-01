const sendAsync = (params) => new Promise((resolve, reject) => {
  web3.currentProvider.sendAsync(params, function(err, res) {
    if (err) {
      reject(err)
    } else {
      resolve(res)
    }
  })
})

// Limited for use on the testrpc
module.exports = {
  timer: (s, opts={}) => {
    return sendAsync({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [s],
      id: new Date().getTime() // Id of the request; anything works, really
    }).then(res => {
      if (opts.mine) {
        // mine a block to update latest block timestamp
        return sendAsync({
          jsonrpc: '2.0',
          method: 'evm_mine',
          id: new Date().getTime()
        })
      } else {
        return Promise.resolve(res)
      }
    })
  },
  assertRevert: (error) =>{
    assert.isAbove(error.message.search('revert'), -1, 'Error containing "revert" must be returned');
  },
  getBlockNow() {
    return web3.eth.getBlock(web3.eth.blockNumber).timestamp // base timestamp off the blockchain
  }
}
