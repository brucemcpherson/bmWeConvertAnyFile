/**
 * uses apps script caching
 * this is an in memory cache to cut down on going to real cache or prop store
 */

/**
 * typedef PreCacheOptions
 * @property {number} [evictAfter = 60000] store memory cache eviction after this timewill still work
 * @property {number} [maxLength =5000000] start evicting if cache reaches this size
 * @property {boolean} [log=false] logging
 * @return {PreCache}
 */
class PreCache {
  /**
   * @param {PreCacheOptions}
   * @return {PreCache}
   */
  constructor({ evictAfter = 60000, maxLength = 10000000, log = false } = {}) {
    // there is a small memory cache to store stuff in to avoid going to cache/props every time
    this._cc = new Map()
    this.evictAfter = evictAfter
    this.maxLength = maxLength
    this._ccBytes = 0
    this.hits = 0
    this.misses = 0
    this.expires = 0
    this.log = log
    this.running = 0
    this.ops = 0
  }

  get _now() {
    return new Date().getTime()
  }
  /**
   * clean up store old stuff
   */
  _evict() {
    Array.from(this._cc).forEach(([key, value]) => {
      if (this._expired(value)) this.remove(key)
    })
  }

  _expired({ stamp }) {
    return stamp + this.evictAfter < this._now
  }

  remove(key) {
    if (this._cc.has(key)) {
      if (this.log) console.log('_removing ', key, 'size', this._ccBytes)
      const v = this._cc.get(key)
      this._ccBytes -= JSON.stringify(v).length
      this._cc.delete(key)
      if (this.log) console.log('_removed ', key, 'size', this._ccBytes)
    }
  }

  _enoughRoom(svob) {
    return this.maxLength >= this._ccBytes + svob.length
  }

  /**
   * set a value to cache
   * @param {string} key the key
   * @param {*} value the date to set
   * @return {string} the value 
   */
  set(key, value) {

    if (this.log) console.log('_setting ', key, 'size', this._ccBytes)
    if (Exports.Utils.isUndefined(value)) throw `setting precache to undefined is not allowed for key ${key}`

    const vob = {
      value,
      stamp: this._now
    }

    //this is just an estimate for size
    const svob = JSON.stringify(vob)

    // will there ever be enough room?
    if (svob.length > this.maxLength) {
      if (this.log) {
        console.log('object was too big for precache', svob.length)
      }
      return null
    }

    // is there room
    if (!this._enoughRoom(svob)) this._evict()

    // get rid of stuff till there is enough room
    while (!this._enoughRoom(svob) && this._cc.size) {
      const [k] = this._cc.keys()
      this.remove(k)
    }

    // this shouldnt happen as we already checked if it would fit
    if (!this._enoughRoom(svob))
      throw `failed to write precache key ${key} - there should have been enough room`

    // finally, write it
    this._cc.set(key, vob)
    this._ccBytes += svob.length
    if (this.log) console.log('_set ', key, 'size', this._ccBytes)
    return value
  }

  _logOp (now) {
    this.running += (new Date().getTime() -  now)
    this.ops++
  }

  /**
   * get a value from cache
   * @param {string} key the key
   * @return {*} the value 
   */
  get(key) {
    const u = Exports.Utils
    const now = new Date().getTime()

    if (this.log) console.log('_getting ', key, 'size', this._ccBytes)
    // from the map
    let cc = this._cc.has(key) && this._cc.get(key)

    // it wasnt there
    if (!cc) {
      this.misses++
      this._logOp (now)
      return undefined
    }

    // maybe it's expired
    if (this._expired(cc)) {
      this.expires++
      this._evict()
      this._logOp (now)
      return undefined
    }

    if (this.log) console.log('_got ', key, 'size', this._ccBytes)
    this.hits++
    this._logOp (now)
    return cc.value
  }

  report() {
    return {
      hits: this.hits,
      misses: this.misses,
      expires: this.expires,
      ops: this.ops,
      running: this.running,
      msperop: this.running/this.ops,
      savedms:  (this.ops * 50) - this.running
    }
  }
  /**
   * delete a key
   * @param {string} key the item to delete
   */
  delete(key) {
    return this.remove(key)
  }
  /**
   * clear everything
   */
  clear() {
    this._cc = new Map()
    this._ccBytes = 0
  }
}

