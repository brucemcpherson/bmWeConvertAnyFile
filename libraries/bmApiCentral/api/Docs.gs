class Docs {

  constructor({
    tokenService,
    apiKey,
    id
  } = {}) {
    this.id = id
    this.endpoint = "https://docs.googleapis.com/v1/documents"
    this.docEndpoint = `/:id`
    this.methodEndpoint = `${this.docEndpoint}:method`
    this.defaultFields = "*"
    // and a longer expiry on processing
    this.docFetcher = Exports.newFetch({
      defaultParams: { key: apiKey },
      tokenService,
      // 10 mins
      expiry: 60 * 10,
      endpoint: this.endpoint
    })

  }

  /**
   * get a doc
   * @param {object} params
   * @param {string} params.id the file id
   * @param {boolean} [params.noisy=false] whether to log
   * @param {boolean} [params.throwOnError] whether to throw on error
   * @param {boolean} [params.noCache] whether to skip caching
   * @return {FetchResponse} the file content
   */
  get({ id, noisy = false, noCache = false, throwOnError }, ...params) {

    return this.docFetcher.fetch({
      path: this.getDocumentPath(id),
      noCache,
      noisy,
      throwOnError
    },
      ...params.concat([{ fields: this.defaultFields }]))
  }

  getMethodUrl(id = this.id) {
    return this.methodEndpoint.replace(":id", id)
  }

  getDocumentPath (id = this.id) {
    return this.docEndpoint.replace(":id", id)
  }


  /**
    * batch requests
    * 
    */
  getBatchRequests({
    requests,
    writeControl = {}
  }) {
    return {
      requests,
      writeControl
    }

  }


  /** 
    * batch process a bunch of documents
    */
  batch({
    requests,
    writeControl,
    noCache = false,
    noisy = false,
    id
  }) {

    // make batch config package
    const payload = this.getBatchRequests({
      requests,
      writeControl,
    })

    // process
    return this._post({
      noCache,
      noisy,
      docEndpoint: this.getMethodUrl(id),
      payload,
      type: ":batchUpdate"
    })
  }

  _post({
    noCache = false,
    noisy = false,
    docEndpoint = this.endpoint,
    payload,
    type
  }) {

    if (!docEndpoint) throw 'docEndpoint not specified'
    const cacher = this.docFetcher.cacher
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
    const path = docEndpoint.replace(/(.*):(.*$)/, `$1${type}`)

    // args for the fetcher
    const args = {
      options,
      noCache,
      noisy,
      keyer,
      path
    }


    // do the fetch
    return this.docFetcher.fetch(args).data
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


}


