var Exports = {

  get libExports () {
    return bmPreCache.Exports
  },


  get Deps () {
    return this.guard(Deps)
  },


  /**
   * Store instance with validation
   * @param {...*} args
   * @return {Store} a proxied instance of store with property checking enabled
   */
  newStore(...args) {
    return this.libExports.newStore (...args)
  },

  /**
   * Cacher instance with validation
   * @param {...*} args
   * @return {Cacher} a proxied instance of cacher with property checking enabled
   */
  newCacher(...args) {
    return this.libExports.newCacher (...args)
  },

  /**
   * fetch class
   * @implements {Fetch} 
   */
  get Fetch() {
    return Fetch
  },

  /**
   * Fetch instance with validation
   * @param {...*} args
   * @return {Fetch} a proxied instance of Fetch with property checking enabled
   */
  newFetch(...args) {
    return this.guard(new this.Fetch(...args))
  },


  /**
   * PreCache instance with validation
   * @param {...*} args
   * @return {PreCache} a proxied instance of PreCache with property checking enabled
   */
  newPreCache(...args) {
    this.libExports.newPreCache (...args)
  },

  /**
   * DocumentAI class
   * @implements {DocumentAI} 
   */
  get DocumentAI() {
    return DocumentAI
  },

  /**
   * DocumentAI instance with validation
   * @param {...*} args
   * @return {DocumentAI} a proxied instance of DocumentAI with property checking enabled
   */
  newDocumentAI(...args) {
    return this.guard(new this.DocumentAI(...args))
  },

  /**
   * Language class
   * @implements {Language} 
   */
  get Language() {
    return Language
  },

  /**
   * Language instance with validation
   * @param {...*} args
   * @return {Language} a proxied instance of Language with property checking enabled
   */
  newLanguage(...args) {
    return this.guard(new this.Language(...args))
  },

  /**
   * Docs class
   * @implements {Drv} 
   */
  get Docs() {
    return Docs
  },

  /**
   * Docs instance with validation
   * @param {...*} args
   * @return {docs} a proxied instance of docs with property checking enabled
   */
  newDocs(...args) {
    return this.guard(new this.Docs(...args))
  },

  /**
   * Drv class
   * @implements {Drv} 
   */
  get Drv() {
    return Drv
  },

  /**
   * Drv instance with validation
   * @param {...*} args
   * @return {Drv} a proxied instance of Drv with property checking enabled
   */
  newDrv(...args) {
    return this.guard(new this.Drv(...args))
  },

  /**
   * Gcs class
   * @implements {Gcs} 
   */
  get Gcs() {
    return Gcs
  },

  /**
   * Gcs instance with validation
   * @param {...*} args
   * @return {Gcs} a proxied instance of Gcs with property checking enabled
   */
  newGcs(...args) {
    return this.guard(new this.Gcs(...args))
  },

  /**
   * Operation class
   * @implements {Operation} 
   */
  get Operation() {
    return Operation
  },

  /**
   * Operation instance with validation
   * @param {...*} args
   * @return {Operation} a proxied instance of Operation with property checking enabled
   */
  newOperation(...args) {
    return this.guard(new this.Operation(...args))
  },


  /**
   * Utils namespace
   * @return {Utils} 
   */
  get Utils() {
    return this.libExports.Utils
  },

  /**
   * Store instance with validation
   * @param {...*} args
   * @return {Unit} a proxied instance of unit testing class
   */
  newUnit(...args) {
    return this.guard(new this.Unit(...args))
  },
  
  newPreFiddler (...args) {
    return this.guard (bmPreFiddler.PreFiddler().getFiddler(...args))
  },
  
  // used to trap access to unknown properties
  guard (target) {
    return new Proxy ( target , this.validateProperties)
  },

  

  /**
   * for validating attempts to access non existent properties
   */
  get validateProperties() {
    return {
      get(target, prop, receiver) {
        // typeof and console use the inspect prop
        if (
          typeof prop !== 'symbol' &&
          prop !== 'inspect' &&
          !Reflect.has(target, prop)
        ) throw `guard detected attempt to get non-existent property ${prop}`

        return Reflect.get(target, prop, receiver)
      },

      set(target, prop, value, receiver) {
        if (!Reflect.has(target, prop)) throw `guard attempt to set non-existent property ${prop}`
        return Reflect.set(target, prop, value, receiver)
      }
    }
  }

}



