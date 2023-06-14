class Memory  {

  constructor ({log=false} ={}) {
    this.log = log
    this.store = new Map ()
  }

  get (key) {
    if (this.has(key)) {
      if (this.log)console.log ('got data for key', key)
      return this.store.get (key)
    }
    if (this.log) console.log ('no data for key', key)
    return null 
  }

  set (key, value) {
    if (Exports.Utils.isUndefined (value)) console.log ('cant set undefined to key', key)
    if (this.log) console.log ('setting data for key', key)
    return this.store.set(key ,value)
  }

  has (key) {
    return this.store.has (key)
  }
  
  clear () {
    if (this.log) console.log ('clearing memory')
    this.store = new Map ()
  }
  
  makeStale () {
    return this.clear()
  }

}

