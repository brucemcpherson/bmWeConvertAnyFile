// These are for dependencies that might come from the caller
// in order o make the library dependecy free
var Deps = (()=> {

  const funcs = {
    tokenService: null,
    fetch: null
  }

  const init =  ({ tokenService = null, fetch }) => {
    funcs.tokenService = tokenService
    funcs.fetch = fetch
  }

  const check = () => {
    Reflect.ownKeys (funcs).forEach (f=>{
      if (funcs[f]){
        if(!Exports.Utils.isFunction(funcs[f])) throw (`did you run Deps.init ? ${f} is not a function`)
      }
    })
    return true
  }


  return {
    init,
    check,
    get tokenService () {
      return funcs.tokenService
    },
    get fetch () {
      return funcs.fetch
    }
  }

})()
 