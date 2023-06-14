/**
 * this the state management central for this app
 * since it uses server, html service and cardservice
 * all state management and communication between them is handled here
 */
const StorePack = (() => {

  // this app only uses memory cache as no persistence is needed ot api calls cached
  const LOG = false;

  let memory = null

  return {
    get memory() {
      if (!memory) {
        memory = Exports.newMemory({
          log: LOG
        })
      }

      return memory
    }
  };
})();


/**
 * this the state management central for this app
 * since it uses server, html service and cardservice
 * all state management and communication between them is handled here
 */
const AppStore = {


  // use these to clear all caches
  clearMemory() {
    this.memory.clear();
  },

  get memory() {
    return Exports.StorePack.memory;
  },


  // shortcut to get a gcs instance
  get drv() {
    const d = Exports.newDrv()
    return d
  },

  set aboutData(value) {
    this.memory.set('aboutData', value)
  },

  get aboutData() {
    return this.memory.get('aboutData')
  },

  // info about the drive service
  // mainly this will come from cached
  get drvAbout() {
    // maybe we already have in memory (avoid cache lookup)
    if (this.aboutData) return this.aboutData
    this.aboutData = this.drv.about({ throwOnError: true, noCache: false }).data
    return this.aboutData
  },

  isDocUrl(url) {
    return url && url.match(/^https:\/\/docs.google.com\/feeds.*/)
  },

  isDocMimeType(mimeType) {
    return mimeType && mimeType.match(/^application\/vnd\.google-apps\..*/)
  },

  // it can be awkward to get the extension for a mimetype
  // creating a blob and letting it figure it out can do some of the work
  patchName({ name, mimeType }) {

    // make a new blob and get as the contentType
    const blob = Utilities.newBlob([], mimeType, name).getAs(mimeType)
    const newName = blob.getName()
    // all good - we have a replacement
    const [fileName, extension] = newName.replace(/(.*)(\..*$)/, "$1,$2").split(",")
    if (newName !== name) {
      return {
        name: newName,
        fileName,
        extension
      }
    } else if (this.isDocMimeType(mimeType)) {
      return {
        name: fileName,
        extension: '',
        fileName
      }
    } else {
      //now for things it gets wrong or doesnt do
      return {
        name,
        extension,
        fileName,
        error: "extension not changed"
      }
    }

  },


  set drvAbout(value) {
    this.userCache.set('drvAbout', value)
  },

  convert({ file, to, throwOnError, noisy, throwOnWarning, noCache, outputFolder, name, loggy }) {

    const rf = new Exports.RouteFinder()
    const as = this
    const drv = Exports.newDrv()

    const apiParams = {
      noCache,
      noisy,
      throwOnError
    }
    const pack = {
      file,
      to
    }

    // general name fixer
    const patcher = (file) => as.patchName ({name: file.name, mimeType: to})

    // generalerror chucker
    const checker = (pack, error) => {
      pack.error = error
      if (throwOnWarning) throw pack.error
      if (loggy) console.log(pack.error)
      return pack
    }

    // check that this is a type we know about
    const known = rf.isKnown(file.mimeType)
    if (!known) {
      return checker (pack, 'dont know ' + file.mimeType)
    }

    // this will calculate which conversions are needed
    const route = rf.find({ from: file.mimeType, to })

    // check there is a route
    if (!route.length) {
      return checker (pack, 'no route to ' + to + ' from ' + file.mimeType)
    }

    // general reporter
    const reportConversion = ({ action, input, output, noisy }) => {
      if (noisy) {
        console.log(
          `...${action}`, input.mimeType,
          input.name, " to ", output.name, output.mimeType
        )
      }
    }
    // final file name
    name = name || file.name

    // processs through all the routes
    const conversion = route.reduce((p, c, passNumber) => {

      // standard upload closure
      const upload = ({ blob }, ...params) => {
        return drv.upload({
          ...apiParams,
          blob,
          mimeType: c.to
        }, ...params.concat([{convert: true}]))
      }

      // standard copy 
      const copy = () => drv.copy({ ...apiParams, id: p.file.id })

      // standard download closure
      const download = () => drv.download({ ...apiParams, id: p.file.id })

      // standard export closure
      const exporter = () => drv.export({ ...apiParams, id: p.file.id, mimeType: c.to })

      // report closure
      const commit = (output) => {
        reportConversion({ action: c.action, input: p.file, output, noisy })
        p.file = output
        c.files = {
          input: p.file,
          output
        }
      }

      // add to deletion pile
      const markForDelete = (file) => {
        if (!passNumber) return null
        if (!file.name.match(new RegExp("^" + drv.getTempName()))) throw `${file.name} incorrectly marked for deletion`
        p.deletions.push(file)
        return file
      }

      // now do the conversion
      if (c.action === 'copy') {

        const { data: output } = copy()

        // maybe need to markfor deletion - but with a copy i doubt it
        markForDelete(p.file)

        // log it
        commit(output)

      } else if (c.action === 'blobvert') {

        // this is a conversion between image types

        // import the current binary 
        const { blob, data: input } = download()

        // upload and convert
        const { data: output } = upload({
          blob: blob.getAs(c.to)
        })

        // maybe need to markfor deletion
        markForDelete(input)

        // log it
        commit(output)

      } else if (c.action === 'import') {

        //---this action is an import (for example a word file) 


        // import the current binary 
        const { blob, data: input } = download()


        // upload and convert
        const { data: output } = upload({
          blob
        })

        // maybe need to markfor deletion
        markForDelete(input)

        // log it
        commit(output)

      } else if (c.action === 'export') {

        //---this action is an export (for example a google doc)

        const { blob, data: input } = exporter()

        // now commit it
        const { data: output } = upload({ blob })

        // maybe need to markfor deletion
        markForDelete(input)

        // log it
        commit(output)

      } else {

        throw `unknown action ${c.action}`
      }

      // at the final stage, rename to the correct thing
      if (p.file.mimeType === to) {
        const patch = patcher(file)
        p.file = drv.updateMetadata({
          id: p.file.id,
          metadata: {
            name: patch.name
          },
          noisy,
          throwOnError: true
        }, [{
          removeParents: p.file.parents.join(","),
          addParents: outputFolder.id
        }]).data

        if (loggy) {
          console.log('.completed conversion of', file.name, file.mimeType, 'to', p.file.name, p.file.mimeType)
        }
      }
      return p
    }, {
      file,
      route,
      deletions: []
    })
    // clean up temp files
    conversion.deletions.forEach(f => {
      // drv.delete({noisy, id: f.id})
      if (loggy) {
        console.log('.deleted temp file', f.name, f.mimeType)
      }
    })

    return conversion
  }

}

