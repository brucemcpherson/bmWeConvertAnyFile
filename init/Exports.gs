var Exports = {

  /**
   * AppStore object proxy
   * @return {AppStore}
   */
  get AppStore() {
    return this.guard(AppStore)
  },

  get libExports() {
    return bmApiCentral.Exports
  },

  get Deps() {
    return this.libExports.Deps
  },

  get Memory (){
    return Memory
  },

  get Convertor () {
    return Convertor
  },

  get Unit () {
    return bmUnitTester.Unit
  },


  /**
   * Memory instance with validation
   * @param {...*} args
   * @return {Memory} a proxied instance of Memory with property checking enabled
   */
  newMemory(...args) {
    return this.guard ( new this.Memory(...args))
  },

  /**
   * RouteFinder class
   * @implements {RouteFinder} 
   */
  get RouteFinder() {
    return RouteFinder
  },

  /**
   * StorePack namespace
   * @return {StorePack} 
   */
  get StorePack() {
    return StorePack
  },
  
  /**
   * RouteFinder instance with validation
   * @param {...*} args
   * @return {RouteFinder} a proxied instance of RouteFinder with property checking enabled
   */
  newRouteFinder(...args) {
    return this.guard(new this.RouteFinder(...args))
  },

  /**
   * Drv instance with validation
   * @param {...*} args
   * @return {Drv} a proxied instance of Drv with property checking enabled
   */
  newDrv(...args) {
    return this.libExports.newDrv(...args)
  },

  /**
   * Utils namespace
   * @return {Utils} 
   */
  get Utils() {
    return this.libExports.libExports.Utils
  },
  
  // used to trap access to unknown properties
  guard(target) {
    return new Proxy(target, this.validateProperties)
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



