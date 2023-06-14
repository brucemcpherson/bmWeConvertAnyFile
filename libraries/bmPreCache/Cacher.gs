/**
 * uses apps script caching
 * will compresss all data
 * if necessary will spill over multiple cache entries
 */

/**
 * typedef CacherOptions
 * @property {CacheService} [cachePoint=null] the cacheservice to use - if null no cachng will be done, but all methods will still work
 * @property {number} [expiry = 60*60] default expiry in seconds
 * @property  {string} [prefix='bmCachePoint] can be used to change key generation algo to partition cache entries
 * @property {boolean} [stale=false] whether to use stale cache processing
 * @property {string} [staleKey='stale'] key to use to get stale value
 * @property {boolean} [log=false] whether to log interacions
 * @property {number} [evictAfter = 30000] store memory cache eviction after this time
 * @property {number} [maxLength = 5000000] max bytes to hold in memory cache
 * @property {boolean} [reCache = false] wether to refresh itesm on access
 * @return {Cacher}
 */

/**
 * @class Cacher
 * @classdesc a cache manager
 */
class Cacher {
  /**
   * @param {CacherOptions}
   */
  constructor({
    cachePoint = null,
    expiry = 60 * 60,
    prefix = 'bmCachePoint',
    staleKey = 'stale',
    stale = false,
    log = false,
    reCache = false,
    evictAfter = 60000,
    maxLength = 5000000
  }) {
    this.cachePoint = cachePoint
    this.expiry = expiry
    this.prefix = prefix
    this.staleKey = staleKey
    this.stale = stale
    this.log = log
    this.reCache = reCache
    if (this.stale && !this.staleKey) throw `Must specify a staleKey if stale is active`
    this.preCache = maxLength ? Exports.newPreCache({ evictAfter, log, maxLength }) : null
  }

  report () {
    return this.preCache ? this.preCache.report() : null
  }

  /**
   * create a key from arbitrary args
   * @param {...*} var_args
   * return {string}
   */
  digester(...args) {
    return Exports.Utils.digester (...args)
  }

  /**
   * make a digest to key on
   * @param {string} key the key to identify the data being cached
   * @param {*} [options=''] any additional options to add to the key
   * @return {string} the key
   */
  keyer(key, options = '') {
    return this.digester(this.staleValue(), this.prefix, key, options)
  }

  /**
   * @return {Boolean} whether to allow item to be retrieved from cache
   */
  get cacheable() {
    return Boolean(this.cachePoint)
  }

  get staler() {
    return this.staleKey + '_' + this.prefix
  }
  /** 
   * if there's a stalekey its value will be added to the prefix
   * @return {string}
   * */
  staleValue() {
    return (this.stale && this.cachePoint.get(this.staler)) || ''
  }

  /**
   * update stale value
   */
  makeStale() {
    if (!this.stale) return null
    const staleValue = Utilities.getUuid()
    this.cachePoint.put(this.staler, staleValue, this.expiry + 30)
    if (this.preCache) this.preCache.clear()
  }

  /**
   * get item fom cache
   * @param {string} key the key to identify the data being cached 
   * @param {*} [options] any additional options to add to the key
   * @return {string || null} value from cache
   */
  get(key, options) {
    // we can't cache this
    if (!this.cacheable) return null

    // best to get it from precache
    // we dont need to worry about the stale key
    // as makestale clears precache anyway
    let data = this.preCache && this.preCache.get(key)
    if (data) {
      if (this.log)console.log('got ', key, 'from precache')
      return data
    }

    // create a key from the request uniqueness
    const digestedKey = this.keyer(key, options)
   

    // get it from cache if we can
    data = this.cachePoint.get(digestedKey)
    if (this.log) {
      console.log('cacherlog', 'getting', key, options, digestedKey, data ? data.slice(0, 100) : 'no data')
    }
    if (!data) return null


    // now we need to establish whether this was spread over several cache entries and dechunk it
    let {
      keys,
      chunk
    } = Compress.verifyKeys(digestedKey, JSON.parse(data))

    // if we have some children
    const bits = keys.length ? this.cachePoint.getAll(keys) : {}

    chunk = keys.reduce((p, c) => {
      const bit = bits[c]
      if (!bit) {
        console.log(`warning: Missing cache entry ${c} for ${digestedKey} - invalidating cache entry`)
        return null
      }
      return p ? p += Compress.verifyKeys(digestedKey, JSON.parse(bit)).chunk : null
    }, chunk)

    // finally decompress
    const result = Compress.decompress(chunk)

    // refresh the cache entry with a new version if reCache property is set
    // expiry will be the default expiry 
    // (rather than the original - probably the same - but we dont have access to that now)
    if (this.reCache) {
      this.set(key, result, {
        options
      })
    }

    // it wasnt in precache so set it for next time
    if (this.preCache) {
      this.preCache.set (key , result)
    }
    return result
  }

  /**
   * set item to cache
   * @param {string} key the key to identify the data being cached 
   * @param {string} data
   * @param {object} [params] 
   * @param {*} [params.options] any extra stuff to add to the key key
   * @param {expiry} [params.expiry] expiry in seconds to override the default cacher settings
   * @return {string || null} value from cache
   */
  set(key, data, {
    options,
    expiry = this.expiry
  } = {}) {
    // we can't cache this
    if (!this.cacheable) return null

    // create a key from the request uniqueness
    const digestedKey = this.keyer(key, options)
    
    if (this.log) {
      console.log('cacherlog', 'setting', expiry, key, options, digestedKey, data ? data : 'no data')
    }
    // if there's no data to write, clear previous occupant
    if (Exports.Utils.isNU(data)) {
      if (this.preCache) this.preCache.remove(key)
      this.cachePoint.remove(digestedKey)
      return null
    }
    // we dont compress for memory access
    if (this.preCache) {
      this.preCache.set (key , data)
    }
    // compress the data
    const { parent, children } = Compress.keyChunks(digestedKey, data)

    // put them all at once
    if (children.length) {
      const bits = children.reduce((p, c) => {
        p[c.key] = JSON.stringify(c)
        return p
      }, {})
      // we'll give the children a longer expiry in case the header disappears first
      const t = new Date().getTime()
      this.cachePoint.putAll(bits, expiry + 10)
    }
    // write the header
    
    this.cachePoint.put(digestedKey, JSON.stringify(parent), expiry)
    return data

  }
  // just an alias
  delete (key, options) {
    return this.remove(key,options)
  }
  /**
   * remove item fom cache
   * @param {string} key the key to identify the data being cached
   * @param {*} [options] any additional options to add to the key
   */
  remove(key, options) {
    const digestedKey = this.keyer(key, options)
    if (this.cachePoint) {
      if (this.log) {
        console.log('cacherlog', 'removing', key, options, digestedKey)
      }
      this.cachePoint.remove(digestedKey)
    }
    if (this.preCache) this.preCache.remove(key)
  }
}
