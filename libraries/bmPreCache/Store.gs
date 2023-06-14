/**
 * @Class Store
 * GWAO uses property store a lot to persist values through instantiation
 * this class provides a simpel interface for that
 */

class Store {
  /**
   * @constructor
   * @param {PropertiesStore} store the store to use
   * @param {number} [evictAfter = 30000] store memory cache eviction after this time
   * @param {number} [maxLength = 100000] max bytes to hold in memory cache
   * @return {Store} 
   */
  constructor({ store, log = false, evictAfter = 60000, maxLength = 5000000 } = {}) {
    // there is a small memory cache to store stuff in to avoid going to cache/props every time
    this.store = store
    if (!this.store) throw 'please supply a property store parameter to the Store constructor'
    this.log = log
    if (maxLength) this.preCache = new Exports.PreCache({ evictAfter, log, maxLength })
  }



  report() {
    return this.preCache ? this.preCache.report() : null
  }

  /**
   * to make stuff in property store more versatile we'll convert it to an object and obify it
   * @param {*} ob
   * @return string
   */
  obify(ob) {
    return JSON.stringify({
      ob
    })
  }

  /**
   * to make stuff in property store more versatile we'll convert it to an object and obify it
   * this undoes that
   * @param {string} value the value from store
   * @return {*}
   */
  unobify(value) {
    const u = Exports.Utils

    // if its null or undefined then we didn't get anything
    if (u.isNU(value)) return null

    // otherwise we should have a value wrapped in an ob property
    if (!u.isString(value)) throw 'expected value from store to be a string'
    const vob = JSON.parse (value)
    if (!Reflect.has(vob, 'ob')) throw `expected an ob property from store value`
    const {ob} =vob
    if (u.isUndefined(ob)) throw `unexpected undefined ob property from store value`
    return ob
  }


  _remove(key) {
    if (this.preCache) this.preCache.remove(key)
    this.store.deleteProperty(key)
  }

  /**
    * put to property store
    * @param {string} key store agains this key
    * @param {*} value thing to write
    */
  set(key, value) {
    const u = Exports.Utils
    if (u.isUndefined(value)) throw `attempt to set store value of ${key} to undefined`

    if (this.log) console.log('storelog', 'setting', key, value)
    
    // if it's null, that's a valid setting
    if (this.preCache) {
      this.preCache.set(key, value)
    }

    // obify and set in store too
    const payload = this.obify(value)
    this.store.setProperty(key, payload)
    
    return value
  }



  /**
   * @param {string} key stored agains this key
   * @return {string} the value
   */
  get(key) {
    // is it in preCache
    // result will be undefined if not (because null is a valid value)
    const u = Exports.Utils
    let value = this.preCache && this.preCache.get(key)
    if (u.isUndefined(value)) {
      value = this.unobify(this.store.getProperty(key))
      // set it in precache for next time
      this.preCache.set(key,  value )
    }
    if (this.log) console.log('storelog', 'getting', key, value)
    return value
  }

  /**
   * @param {string} key stored agains this key
   */
  delete(key) {
    const k = key
    if (this.log) console.log('storelog', 'removing', k)
    this._remove(k)
    return null
  }
}
