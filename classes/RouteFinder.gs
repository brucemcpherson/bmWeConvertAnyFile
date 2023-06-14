/**
 * this library takes any blob and finds a awy to convert it to another
 * using DriveAbout to figure out what can be converted to what
 */
class RouteFinder {
  constructor() {

  }

  /**
   * get tall about drv caabilities
   */
  get drvAbout() {
    const as = Exports.AppStore
    return as.drvAbout
  }

  /**
   * the type of files drv knowns how to import
   * NOTE - although images are classed as importable - they are not importable as images - only on text with convert : true
   * so I'm going to rule them out for now
   * TODO - allow some kind of convert to text route option
   */
  get importTypes() {
    const imps= this.drvAbout.importFormats
    return imps
    /*
    return Reflect.ownKeys(imps).reduce ((p,c) => {
      if (!this.isImage(c)) p[c] = imps[c]
      return p
    }, {})
    */
  }

  /**
   * the type of files drv knows how to export
   */
  get exportTypes() {
    return this.drvAbout.exportFormats
  }

  get images () {
    return  ['image/bmp', 'image/gif', 'image/jpeg', 'image/png']
  }

  isImage (mimeType) {
    return this.images.includes(mimeType)
  }

  /**
   * these are types that can be converted interchangeably without bothering to import/export
   */
  get blobvertTypes() {
    const images = this.images
    return {
      "image/bmp": images,
      "image/gif": images,
      "image/jpeg": images,
      "image/png": images
    }
  }

  /**
   * get possible exports from a given mimetype
   */
  exportTos(from) {
    const { exportTypes } = this
    return exportTypes[from]
  }

  importTos(from) {
    const { importTypes } = this
    return importTypes[from]
  }

  blobvertTos(from) {
    const { blobvertTypes } = this
    return blobvertTypes[from]
  }

  get exportFroms() {
    return Array.from(new Set(Reflect.ownKeys(this.exportTypes))).sort()
  }

  get importFroms() {
    return Array.from(new Set(Reflect.ownKeys(this.importTypes))).sort()
  }

  get blobvertFroms() {
    return Array.from(new Set(Reflect.ownKeys(this.blobvertTypes))).sort()
  }

  get importTargets() {
    const { importTypes } = this
    return Array.from(new Set(this.importFroms.map(f => importTypes[f]).flat(Infinity))).sort()
  }

  get exportTargets() {
    const { exportTypes } = this
    return Array.from(new Set(this.exportFroms.map(f => exportTypes[f]).flat(Infinity))).sort()
  }

  get blobvertTargets() {
    const { blobvertTypes } = this
    return Array.from(new Set(this.blobvertFroms.map(f => blobvertTypes[f]).flat(Infinity))).sort()
  }

  isExportable(type) {
    return this.exportFroms.includes(type)
  }

  isImportable(type) {
    return this.importFroms.includes(type)
  }

  isblobvertable(type) {
    return this.blobvertFroms.includes(type)
  }

  /**
   * all known types
   */
  get knownTypes() {
    return Array.from(new Set(
      Reflect.ownKeys(this.exportTypes)
        .concat(this.blobvertTargets, this.exportTargets, this.importTargets, Reflect.ownKeys(this.importTypes))
    )).sort()
  }

  /**
   * check if a type is known
   */
  isKnown(type) {
    return this.knownTypes.includes(type)
  }

  /**
   * find route between mimetypes
   */
  find({ from, to }) {
    const u = Exports.Utils
    if (u.isNU(from) || u.isNU(to)) throw `missing from/to value(s) ${from} -> ${to}`

    // no need to do anything, or even validate if we know them
    if (from === to) return [{
      from,
      to,
      action: 'copy'
    }]

    // check this is something we know about
    if (!this.isKnown(from)) throw `Unknown 'from' mimetype ${from}`
    if (!this.isKnown(to)) throw `Unknown 'to' mimetype ${to}`

    const route = []
    let nextFrom = from

    const checkblobvert = (nextFrom,to) => {
      
      // for example , a png to a bmp
      if (nextFrom !== to && this.isblobvertable(nextFrom) && this.isblobvertable(to)) {
        const ob = {
          from: nextFrom,
          action: 'blobvert'
        }
        const tos = this.blobvertTos(nextFrom)
        if (!tos) throw `couldnt find tos for ${nextFrom}`
        nextFrom = tos.find(f => f === to)
        if (!nextFrom) throw `missing blobvert route for ${ob.from} -> ${to}`
        route.push({
          ...ob,
          to: nextFrom
        })
      }
      return nextFrom
    }
    

    // this is the preferred method as we dont need to create any files
    nextFrom = checkblobvert (nextFrom,to)

    // for example , a word document to docs
    if (nextFrom !== to && this.isImportable(nextFrom)) {
      const tos = this.importTos(nextFrom)
      if (tos.length !== 1) throw `ambiguous import route for ${nextFrom}`
      nextFrom = tos[0]
      route.push({
        from,
        to: nextFrom,
        action: 'import'
      })
    }

    // this is the preferred method as we dont need to create any files
    nextFrom = checkblobvert (nextFrom,to)

    // for example a doc to pdf
    if (nextFrom !== to && this.isExportable(nextFrom)) {
      const ob = {
        from: nextFrom,
        action: 'export'
      }
      const tos = this.exportTos(nextFrom)
      if (!tos) throw `couldnt find tos for ${nextFrom}`
      nextFrom = tos.find(f => f === to)

      if (!nextFrom) {
        console.log (`missing export route for ${ob.from} -> ${to}`)
        return []
      }
      route.push({
        ...ob,
        to: nextFrom
      })
    }

    // this is the preferred method as we dont need to create any files
    nextFrom = checkblobvert (nextFrom, to)

    return route

  }
}
