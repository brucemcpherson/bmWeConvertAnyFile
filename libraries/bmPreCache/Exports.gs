var Exports = {

  get libExports () {
    return bmUtils.Exports
  },

  get validateProperties () {
    return {
      get(target, prop, receiver) {
        if (!Reflect.has(target, prop)) throw `attempt to get property ${prop} that doesn't exist`
        return Reflect.get(target, prop, receiver)
      },

      set(target, prop, value, receiver) {
        if (!Reflect.has(target, prop)) throw `attempt to set property ${prop} that doesn't exist`
        return Reflect.set(target, prop, value, receiver)
      }
    }
  },
  /**
   * Store class
   * @implements {Store} 
   */
  get Store() {
    return Store
  },

  /**
   * Store instance with validation
   * @param {...*} args
   * @return {Store} a proxied instance of store with property checking enabled
   */
  newStore (...args) {
    return new Proxy (new this.Store(...args), this.validateProperties)
  },

  /**
   * Cacher class
   * @implements {Cacher} 
   */
  get Cacher() {
    return Cacher
  },

  /**
   * Cacher instance with validation
   * @param {...*} args
   * @return {Cacher} a proxied instance of cacher with property checking enabled
   */
  newCacher(...args) {
    return new Proxy(new this.Cacher(...args), this.validateProperties)
  },

  /**
   * PreCache class
   * @implements {PreCache} 
   */
  get PreCache() {
    return PreCache
  },

  /**
   * PreCache instance with validation
   * @param {...*} args
   * @return {PreCache} a proxied instance of PreCache with property checking enabled
   */
  newPreCache(...args) {
    return new Proxy(new this.PreCache(...args), this.validateProperties)
  },

  /**
   * Compress namespace
   * @implements {Compress} 
   */
  get Compress() {
    return Compress
  },

  /**
   * Utils namespace
   * @implements {Utils} 
   */
  get Utils() {
    return this.libExports.Utils
  },
  

}


