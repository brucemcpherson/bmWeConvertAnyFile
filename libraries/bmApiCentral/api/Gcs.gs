/**
 * @class Gcs
 * a wrapper for the cloud storage API
 * https://cloud.google.com/storage/docs/json_api
 */
class Gcs {
  /**
   * @constructor
   * @param {string} bucket the default bucket name for all operations with this instance
   * @param {function} tokenService a function that returns a cloud storage scoped access token
   * @return {Gcs}
   */
  constructor({ bucket, tokenService, apiKey }) {
    this.defaultFields = "kind,name,bucket,contentType,md5Hash,metadata,mediaLink"
    this.bucket = bucket
    this.endpoint = "https://storage.googleapis.com/storage/v1"
    this.bucketpoint = '/b/:bucket/o/'
    this.objectEndpoint = this.endpoint + this.bucketpoint
    this.uploadEndpoint = "https://storage.googleapis.com/upload/storage/v1" + this.bucketpoint
    this.tokenService = tokenService
    // model - https://storage.googleapis.com/storage/v1/b/SOURCE_BUCKET_NAME/o/SOURCE_OBJECT_NAME/rewriteTo/b/DESTINATION_BUCKET_NAME/o/NAME_OF_COPY"
    this.rewriteEndpoint = `${this.objectEndpoint}:SOURCE_OBJECT_NAME/rewriteTo/b/:DESTINATION_BUCKET_NAME/o/:NAME_OF_COPY`
    this.defaultParams = apiKey ? {key: apiKey} : null
  }

  /**
   * make a gs:// style link
   */
  makeGcsLink({ bucket = this.bucket, path = '', name = '' }) {
    return `gs://${[bucket, path, name].filter(f => f).join('/')}`
  }

  /**
   * get name && bucket from a gs:/style link
   */
  unmakeGcsLink({ gcsUri }) {
    const [bucket, name] = gcsUri.replace(/gs:\/\/([^\/]+)\/(.*)/, "$1,$2").split(",")
    return {
      bucket,
      name
    }
  }

  /**
   * get a file from storage using gs:// notation
   */
  gsGet({ gcsUri, noisy, noCache, throwOnError, download }, ...params) {
    return this.get({
      ...this.unmakeGcsLink({ gcsUri }),
      noisy,
      noCache,
      throwOnError,
      download
    }, ...params)
  }

  /**
   * list a folder from storage using gs:// notation
   */
  gsList({ gcsUri, noisy, noCache, throwOnError }, ...params) {
    return this.list({
      ...this.unmakeGcsLink({ gcsUri }),
      noisy,
      noCache,
      throwOnError
    }, ...params)
  }

  /**
   * list files in storage
   * note - doesn't handle more than a pageworth
   * so only designed for small listings
   * GET https://storage.googleapis.com/storage/v1/b/bucket/o
   */
  list({ bucket = this.bucket, name, noisy = false, noCache = true, throwOnError }, ...params) {
    const fetcher = Exports.newFetch({
      endpoint: this.objectEndpoint.replace(':bucket', bucket),
      tokenService: this.tokenService,
      defaultParams: this.defaultParams
    })
    const t = fetcher.fetch({
      noCache,
      noisy,
      throwOnError
    }, ...params.concat([{ prefix: name }]))

    return t
  }


  download(options, ...params) {
    return this.get({ ...options, download: true }, ...params)
  }

  /**
   * get a file from storage
   */
  get({
    bucket = this.bucket,
    name,
    noisy = false,
    noCache = false,
    throwOnError,
    download = false
  }, ...params) {

    const fetcher = Exports.newFetch({
      endpoint: this.objectEndpoint.replace(':bucket', bucket),
      tokenService: this.tokenService,
      defaultParams: this.defaultParams
    })

    const t = fetcher.fetch({
      noCache,
      noisy,
      path: encodeURIComponent(Exports.Utils.singleSlash(name)),
      throwOnError
    },
      ...params.concat([{ fields: this.defaultFields }]))

    if (!download || t.error) return t

    // get the media as well
    const m = fetcher.fetch({
      url: t.data.mediaLink,
      noCache,
      noisy,
      throwOnError
    }, ...params.concat([{ fields: this.defaultFields }]))
    // return the media + the metadata
    return {
      ...m,
      data: t.data
    }
  }

  /**
   * get operation result from metadata
   * @param {object} p 
   * @param {boolean} [p.noisy] whether to log fetch activity
   * @param {booolean} [p.noCache] whether to use cache for results
   * @param {OperationResource.metadata} [p.metdata] operation metadata  
   * @return {object[]} the process status and storage items belonging to each result
   */
  getOperationResult({ noisy, noCache, metadata }, ...params) {
    // deal with operation response
    const { individualProcessStatuses = [] } = metadata

    const results = individualProcessStatuses.map(processStatus => {
      const gcsUri =  processStatus.outputGcsDestination
      if (noisy) console.log('getting op result for', gcsUri)
      if (!gcsUri) {
        console.log('there was no gcsUri for operation - skipping', processStatus)
        return {
          items: [],
          processStatus
        }
      }
      // get the array of items in the folder
      const result = this.gsList({
        gcsUri,
        noisy,
        noCache,
        throwOnError: true
      }, ...params)

      const { items } = result.data
      return {
        processStatus,
        items
      }
    })
    return results
  }

  /**
   * check if a file exists
   * @return {StorageObject} see https://cloud.google.com/storage/docs/json_api/v1/objects#resource
   */
  exists(options, ...params) {

    // do a get but don't fail and don't use cache
    const result = this.get({
      ...options,
      noCache: true,
      throwOnError: false
    }, ...params.concat([{ fields: this.defaultFields }]))

    // this is an okay error
    if (result.error && result.code === 404) return null

    // any other kind of error might not be
    if (result.error && options.throwOnError) throw new Error(result.error.message)
    return result
  }

  /**
   * delete an object
   */
  delete({ bucket = this.bucket, name, throwOnError, noisy }) {
    //DELETE https://storage.googleapis.com/storage/v1/b/bucket/o/object
    const fetcher = Exports.newFetch({
      endpoint: this.objectEndpoint.replace(':bucket', bucket),
      tokenService: this.tokenService,
      defaultParams: this.defaultParams
    })
    const options = {
      method: "DELETE"
    }

    const t = fetcher.fetch({
      options,
      noisy,
      path: encodeURIComponent(Exports.Utils.singleSlash(name)),
      throwOnError
    })
    return t
  }
  /**
   * move 
   * move is actually a rewrite followed by a delete
   * https://cloud.google.com/storage/docs/copying-renaming-moving-objects#copy-object-json
   * @param {object} p
   * @param {string} [p.bucket=this.bucket] source bucket
   * @param {string} p.path path to source object name
   * @param {boolean} [p.noisy=false] whether to report fetches URL on console
   * @param {string} [p.destinationbucket=this.bucket] destination bucket
   * @param {string} p.destinationPath path to destination object name
   * @param {boolean} [p.replaceIfExists = false] whether to replace the file if it already exists
   * @return {object} Fetch result
   */

  move({
    bucket = this.bucket, path, destinationbucket = this.bucket, destinationPath, noisy = false, replaceIfExists = false }) {
    const gcsLink = this.makeGcsLink({ bucket, path })
    const result = this.rewrite({ bucket, path, destinationPath, destinationbucket, noisy, replaceIfExists })
    if (result.error) {
      throw `failed to move file: ${gcsLink} - ${result.error}`
    }
    // can now delete existing
    this.delete({ bucket, name: path, noisy, throwOnError: true })

    return result
  }
  /**
   * rewrite 
   * notice that large files might need several fetches
   * model - https://storage.googleapis.com/storage/v1/b/SOURCE_BUCKET_NAME/o/SOURCE_OBJECT_NAME/rewriteTo/b/DESTINATION_BUCKET_NAME/o/NAME_OF_COPY"
   * https://cloud.google.com/storage/docs/copying-renaming-moving-objects#copy-object-json
   * @param {object} p
   * @param {string} [p.bucket=this.bucket] source bucket
   * @param {string} p.path path to source object name
   * @param {boolean} [p.noisy=false] whether to report fetches URL on console
   * @param {string} [p.destinationbucket=this.bucket] destination bucket
   * @param {string} p.destinationPath path to destination object name
   * @param {boolean} [p.replaceIfExists = false] whether to replace the file if it already exists
   * @return {object} Fetch result
   */

  rewrite({
    bucket = this.bucket, path, destinationbucket = this.bucket, destinationPath, noisy = false, replaceIfExists = false
  }) {
    const gcsLink = this.makeGcsLink({ bucket, path })
    const destGcsLink = this.makeGcsLink({ bucket: destinationbucket, path: destinationPath })
    if (gcsLink === destGcsLink) {
      throw `attempt to rewrite to same object: ${gcsLink}`
    }
    if (!replaceIfExists && this.exists({ bucket: destinationbucket, name: destinationPath })) {
      throw `attempt to overwrite existing object: ${destGcsLink} : specify replaceIfExists: true if required behavior`
    }

    const fetcher = Exports.newFetch({
      endpoint: this.rewriteEndpoint
        .replace(':bucket', bucket)
        .replace(':SOURCE_OBJECT_NAME', Exports.Utils.encoder(path))
        .replace(':DESTINATION_BUCKET_NAME', destinationbucket)
        .replace(':NAME_OF_COPY', Exports.Utils.encoder(destinationPath)),
      tokenService: this.tokenService,
      defaultParams: this.defaultParams
    })
    if (noisy) console.log('..copying', path, 'to ', destinationPath)
    const options = {
      method: "POST"
    }
    let result = fetcher.fetch({ noCache: true, options, noisy })

    // perhaps its not  done yet (if its a big file)
    while (!result.error && !result.data.done) {
      options = {
        ...options,
        payload: {
          rewriteToken: result.data.rewriteToken
        }
      }
      result = fetcher.fetch({ noCache: true, options, noisy })
    }
    return result
  }

  /**
   * upload a file to storage
   * @return {StorageObject[]} see https://cloud.google.com/storage/docs/json_api/v1/objects#resource
   */
  upload({
    bucket = this.bucket,
    path, blob,
    noisy = false,
    md5Name = true,
    replaceIfExists = false,
    metadata,
    name
  }, ...params) {

    const u = Exports.Utils
    const fetcher = Exports.newFetch({
      endpoint: this.uploadEndpoint.replace(':bucket', bucket),
      tokenService: this.tokenService,
      defaultParams: this.defaultParams
    })

    // the name we'll write to storage cound be the md5
    const n = name || (md5Name ? u.md5Checksum(blob) : blob.getName())
    name = u.singleSlash(path + (path ? '/' : '') + n)

    // if we're not replacing we first need to mcheck if it exists
    if (!replaceIfExists) {
      const exists = this.exists({ name, noisy, throwOnError: true })

      if (exists && !exists.error) {
        if (noisy) console.log('..object', name, 'already exists - not replacing')
        return {
          ...exists,
          blob
        }
      } else if (exists) {
        throw 'Unexpected existence check error:' + (exists.error && exists.error.message)
      }
    }

    if (noisy) console.log('..uploading', name, 'to storage')


    // the multipart boundary - could be anything
    const boundary = u.boundary()

    // make the multipart payload
    const payload = fetcher.makeMultiPart({
      name,
      blob,
      boundary,
      metadata
    })

    // final options to upload data
    const options = {
      method: "POST",
      contentType: `multipart/related; boundary=${boundary}`,
      payload
    }

    // now do a multipart upload
    const result = fetcher.fetch({ options, noisy },
      ...params.concat([{ fields: this.defaultFields }]))

    return {
      ...result,
      blob
    }
  }


}



