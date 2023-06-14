class Language {

  constructor({
    tokenService,
    apiKey
  } = {}) {
    this.endpoint = "https://language.googleapis.com/v1beta2"
    // and a longer expiry on processing
    this.processFetcher = Exports.newFetch({
      defaultParams: { key: apiKey },
      tokenService,
      // 23 hours
      expiry: 60 * 60 * 23,
      // because posting is really just a fetch and we want to cache results
      allowCaching: ["GET", "POST"],
      endpoint: this.endpoint
    })

  }

  analyzeSentiment({ content, type = "PLAIN_TEXT", language = "en", noCache, noisy }) {
    const payload = {
      document: {
        content,
        type,
        language
      }
    }
    return this._post({
      noCache,
      noisy,
      payload,
      type: ":analyzeSentiment",
      processEndpoint: "/documents:method",
    })
  }

  _post({
    noCache = false,
    noisy = false,
    processEndpoint,
    payload,
    type
  }) {

    if (!processEndpoint) throw 'processendpoint not specified'
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
    const path = processEndpoint.replace(/(.*):(.*$)/, `$1${type}`)

    // args for the fetcher
    const args = {
      options,
      noCache,
      noisy,
      keyer,
      path
    }


    // do the fetch
    return this.processFetcher.fetch(args).data
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


