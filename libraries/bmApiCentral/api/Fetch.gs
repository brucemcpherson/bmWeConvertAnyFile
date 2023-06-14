class Fetch {

  /**
   * @param {object} p
   * @param {string} p.endpoint the base endpoint
   * @param {function} p.tokenService how to get a token
   * @param {url fetch} p.fetcher url fetch app . fetch
   */
  constructor({ defaultParams , fetch, endpoint, tokenService, expiry = 60 * 60 * 24 - 60, allowCaching = ["GET"] }) {
    Deps.check ()
    this.fetchit = (url, options) => (fetch || Deps.fetch)(url, options)
    this.endpoint = endpoint
    this.tokenService = tokenService || Deps.tokenService
    this.allowCaching = allowCaching
    this.defaultParams = Exports.Utils.arrify(defaultParams)
    this.cacher = Exports.newCacher({
      cachePoint: CacheService.getUserCache(),
      expiry,
      stale: true
    })
  }

  /**
   * get header including oauth token
   */
  getHeaders(headers) {
    return {
      ...(headers || {}),
      Authorization: `Bearer ${this.tokenService()}`
    }
  }

  /**
   * get the url
   */
  getUrl(path = '', ...params) {
    return this.endpoint + path + Exports.Utils.addParams(params)
  }

  /**
   * get the fetch options
   */
  getOptions(options) {
    return {
      method: "GET",
      contentType: "application/json; charset=utf-8",
      muteHttpExceptions: true,
      ...(options || {}),
      headers: {
        ...this.getHeaders(options && options.headers)
      }
    }
  }

  makeMultiPart({ name, blob, boundary, mimeType, metadata = {}}) {

    const u = Exports.Utils
    // the original content type
    const contentType = blob.getContentType()

    // the new mimeType
    mimeType = mimeType || contentType
    const request = {
      name,
      mimeType,
      // for gcs
      metadata: { originalName: blob.getName(), contentType, ...metadata }
    }
    const rn = `\r\n`

    const firstPart = `--${boundary}${rn}` +
      `Content-Type: application/json; charset=UTF-8${rn}${rn}` +
      `${JSON.stringify(request)}${rn}` +
      `--${boundary}${rn}` +
      `Content-Type: ${contentType}${rn}${rn}`
    const secondPart = `${rn}--${boundary}--${rn}`

    const payload = u.toBytes(firstPart)
      .concat(blob.getBytes())
      .concat(u.toBytes(secondPart))
    return payload

  }
  /**
   * do the fetch
   */
  fetch({
    path,
    options,
    noCache = false,
    noisy = false,
    keyer,
    throwOnError = true,
    prolongCache = true,
    url
  } = {}, ...params) {

    const u = Exports.Utils

    // construct the parameterized url or use the preformatted one passed over
    url = url || this.getUrl(path, ...this.defaultParams.concat(params))

    // the key can be a default cache key, or somehow created by a passed function
    const key = keyer ? keyer(url, options) : this.cacher.keyer(url)

    // make a cache pack to emulate a standard response later
    const constructCached = (response) => {
      return {
        // this constructs a compressed version 
        //  has all it needs to reconstruct this as a blob later
        blobby: u.cacheBlob(response.getBlob()),
        headers: response.getHeaders(),
        responseCode: response.getResponseCode()
      }
    }

    // make a standard response
    const constructPack = ({ response, cached = false }) => {
      
      // the blob may have come from cache but its been faked to llok like  real one
      const blob = response.getBlob()
      
      // the FetchResponse skeleton
      const pack = {
        response,
        blob,
        data: null,
        cached,
        error: null,
        code: response.getResponseCode()
      }

      // if the type is JSON, then we need to parse it into the data property
      
      if (blob.getContentType() === 'application/json') {
        try {
          const text = response.getContentText()
          pack.data = (text && JSON.parse(text)) || null
        } catch {
          // just a general who knows why error
          pack.code = 500
          pack.error = 'failed to parse JSON mimetype'
        }
      }
      
      // regular http error
      if (!u.isHttpOk(response.getResponseCode())) {
        pack.error = 'code:' + response.getResponseCode() + ':' + response.getContentText()
      }
      return pack
    }

    // add any ephemeral options
    options = this.getOptions(options)

    // just normaize this
    options.method = options.method.toUpperCase()

    // see if its in cachecheck if caching is allowed
    const allowCaching = this.allowCaching.indexOf(options.method) !== -1

    if (!noCache && allowCaching) {

      // getting the response from cache
      const cached = this.cacher.get(key)
      
      // it existed
      if (cached) {

        // refresh the cache as it's a popular one
        if (prolongCache) this.cacher.set(key, cached)
        if (noisy) {
          console.log('..result came from cache', url, 'for method:', options.method)
        }

        // reconstruct the blob from cache bytes
        const blob = u.unCacheBlob(cached.blobby)

        // make a response that looks like it came from Fetch
        const cachedResult  = constructPack({
          cached: true,
          response: {
            getResponseCode: () => cached.responseCode,
            getHeaders: () => cached.headers,
            getBlob: () => blob,
            getContentText: () => blob.getDataAsString()
          }
        })
        // and we're all done here
        return cachedResult
      }
    }

    // good to know
    if (noisy) console.log('..fetching', options.method, url)

    // do the fetch
    const response = this.fetchit(url, options)

    // make a standard response
    const pack = constructPack({ response, cached: false })
    const codeOk = u.isHttpOk(response.getResponseCode())

    if (!pack.error && codeOk) {
      // if all is good we can write to cache
      if (allowCaching) {
        this.cacher.set(key, constructCached(response))
      }
      return pack
    }

    // deal with failure
    // always delete cache entry if there is one
    this.cacher.remove(key)

    // user is going to handle errors
    if (!throwOnError || codeOk) {
      return pack
    }

    else {
      console.log('failed fetch', response.getResponseCode(), url)
      throw new Error(response.getContentText())
    }

  }
}






