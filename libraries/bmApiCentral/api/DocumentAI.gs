class DocumentAI {

  constructor({
    projectNumber,
    tokenService,
    locationId = 'eu',
    fieldMask,
    skipHumanReview,
    apiKey
  } = {}) {

    this.endpoint = "https://:locationId:documentai.googleapis.com/v1"
    this.tokenService = tokenService 
    this.projectNumber = projectNumber
    this.locationId = locationId

    this.basePayload = {
    }
    if (fieldMask) {
      if (!Array.isArray(fieldMask)) throw 'fieldmask must be an array'
      this.basePayload.fieldMask = fieldMask.join(",")
    }
    if (!Exports.Utils.isNU(skipHumanReview)) {
      this.basePayload.skipHumanReview = Boolean(skipHumanReview)
    }

    // use this fetcher with a shortish cache life for getting processors
    const fetchOptions = {
      endpoint: this.endpoint.replace(':locationId:', locationId === 'eu' || locationId === 'us' ? `${locationId}-` : ''),
      tokenService: this.tokenService,
      // 20 mins
      expiry: 60 * 20,
      defaultParams: apiKey ? {key: apiKey} : null
    }

    this.fetcher = Exports.newFetch(fetchOptions)

    // and a longer expiry on processing
    this.processFetcher = Exports.newFetch({
      ...fetchOptions,
      // 12 hours
      expiry: 60 * 60 * 12
    })
    
  }

  get projectPath() {
    return `/projects/${this.projectNumber}`
  }

  get locationsPath() {
    return this.projectPath + '/locations'
  }

  get operationsPath() {
    const {locationPath} = this
    if (!locationPath) {
      throw 'locationPath not set - did you forget to refresh the add-on after running setup?'
    }
    return '/' + locationPath.name + "/operations"
  }


  get locationPath() {
    return this.listLocations()
      .locations
      .find(f => f.locationId === this.locationId)
  }
  get processorsPath() {
    return '/' + this.locationPath.name + '/processors'
  }
  getProcessorPath({ processorId }) {
    return this.processorsPath + '/' + processorId
  }

  listProcessors({ noisy } = {}) {
    return this.fetcher.fetch({ noCache: true, noisy, path: this.processorsPath }).data
  }

  listLocations({ noisy, noCache } = {}) {
    return this.fetcher.fetch({ path: this.locationsPath, noisy, noCache }).data
  }

  listOperations({ noisy, noCache, params = {filter: {type:'BATCH_PROCESS_DOCUMENTS'} }} = {}) {
    return this.fetcher.fetch({ path: this.operationsPath + Utils.addParams (params), noisy, noCache }).data
  }

  getOperation ({noisy, noCache,  name}) {
    return this.fetcher.fetch({ path:  '/' + name, noisy, noCache }).data
  }

  _post({
    noCache = false,
    noisy = false,
    processEndpoint,
    payload,
    type
  }) {

    if (!processEndpoint) throw 'processendpoint not specified - did you forget to refresh the add-on recently'
    const cacher = this.processFetcher.cacher
    const keyer = (url, options) => {
      return cacher.keyer(
        options.payload,
        options.method + url
      )
    }
    // fetcher options
    const options = this.getOptions({
      payload: JSON.stringify(payload)
    })

    // tweak the processor path
    const url = processEndpoint.replace(/(.*):(.*$)/, `$1${type}`)

    // args for the fetcher
    const args = {
      options,
      noCache,
      noisy,
      keyer,
      url
    }


    // do the fetch
    return this.processFetcher.fetch(args).data
  }


  /** 
   * batch process a bunch of documents
   */
  batchProcess({
    documents,
    operationsUri,
    noCache = false,
    noisy = false,
    processEndpoint
  }) {

    
    
    // make batch config package
    const payload = this._getGcsRequests({
      ...this.basePayload,
      documents,
      operationsUri,
    })
    
    // process
    return this._post({
      noCache,
      noisy,
      processEndpoint,
      payload,
      type: ":batchProcess"
    })
  }

  /**
   * do the fetch for an image
   */
  rawPost({
    blob,
    noCache = false,
    noisy = false,
    processEndpoint
  }) {

    // this mode sends the b64 encoded version of the image to be done
    const payload = {
      ...this.basePayload,
      rawDocument: {
        mimeType: blob.getContentType(),
        content: Exports.Utils.blobToB64(blob)
      }
    }

    return this._post({
      noCache,
      noisy,
      processEndpoint,
      payload,
      type: ":process"
    })

  }


  get operation() {
    return new Operation({ documentai })
  }

  /**
   * get the fetch options
   */
  getOptions(options = {}) {
    return {
      method: "POST",
      contentType: "application/json; charset=utf-8",
      ...options
    }
  }


  /**
   * batch requests
   * 
   */
  _getGcsRequests({
    documents,
    operationsUri,
    fieldMask,
    skipHumanReview
  }) {

    const requests = {
      skipHumanReview,

      inputDocuments: {
        gcsDocuments: {
          documents
        }
      },
      documentOutputConfig: {
        gcsOutputConfig: {
          gcsUri: operationsUri,
          fieldMask
        },
      }
    }

    return requests
  }
}


