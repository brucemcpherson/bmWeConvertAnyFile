/**
/**
 * @class Drv
 * a wrapper for the Drive API
 * https://developers.google.com/drive/api/v3/reference
 */
class Drv {
  /**
   * @constructor
   * @param {function} tokenService a function that returns a cloud storage scoped access token
   * @return {Drv}
   */
  constructor({ tokenService, apiKey } = {}) {
    this.endpoint = "https://www.googleapis.com/drive/v3"
    this.uploadEndpoint = 'https://www.googleapis.com/upload/drive/v3/files'

    this.filepoint = '/files/:fileId'
    this.objectEndpoint = this.endpoint + this.filepoint
    this.listEndpoint = this.endpoint + '/files'
    this.createEndpoint = this.endpoint + '/files'
    this.aboutEndpoint = this.endpoint + '/about'

    this.tokenService = tokenService
    this.defaultFields = 'id,size,name,mimeType,md5Checksum,kind,parents'
    this.defaultAboutFields = 'importFormats,exportFormats,kind'
    this.defaultMimeType = "application/pdf",
      this.apiKey = apiKey
    this.defaultParams = apiKey ? { key: apiKey } : null
  }
  /*
      The MIME type to convert to. For most blobs, 'application/pdf' is the only valid option. For images in BMP, GIF, JPEG, or PNG format, any of 'image/bmp', 'image/gif', 'image/jpeg', or 'image/png' are also valid.
      https://developers.google.com/drive/api/guides/ref-export-formats
  */

  /**
   * @return {string} not found message
   */
  get nf() {
    return 'not found:'
  }

  /**
   * info about the drive service
   * https://www.googleapis.com/drive/v3/about
   * @param {object} p
   * @param {boolean} [p.noisy] whether to log
   * @param {boolean} [p.throwOnError] whether to throw on error
   * @param {boolean} [p.noCache] whether to skip caching
   * @return {FetchResponse} the file content
   */

  /**
   * were after how files can be imported and treated - for example
   * importFormats: [items]
   * this item says that  the mimetype property can be imported as any in the array
   *    { 'application/x-vnd.oasis.opendocument.presentation': [ 'application/vnd.google-apps.presentation' ] }
   * exportFormats: [items]
   * this item says that  the mimetype property can be exported as any in the array
   * 'application/vnd.google-apps.document': 
      [ 'application/rtf',
        'application/vnd.oasis.opendocument.text',
        'text/html',
        'application/pdf',
        'application/epub+zip',
        'application/zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain' ],
   * 
   */

  about({ noisy, noCache, throwOnError }, ...params) {

    const fetcher = this._plainFetcher(this.aboutEndpoint)
    return fetcher.fetch({
      noCache,
      noisy,
      throwOnError
    },
      // you could make this recursive by allowing 
      // folders and adding theor content too.
      ...params.concat([{ fields: this.defaultAboutFields }]))
  }

  /**
   * @param {object} file metadata
   * @return {boolean} whether a file is a file (not a folder)
   */
  isFolder(file) {
    return file.mimeType === this.folderMimeType
  }

  /**
   * mimetype of a folder
   * @return {string}
   */
  get folderMimeType() {
    return 'application/vnd.google-apps.folder'
  }

  /**
   * create a file with just metadata
   * @param {object} meta
   * @return {PackResponse} 
   */
  create({ metadata, noisy, throwOnError }, ...params) {
    const fetcher = this._plainFetcher(this.createEndpoint)
    const options = {
      method: "POST",
      payload: JSON.stringify(metadata),
      contentType: 'application/json',
    }
    return fetcher.fetch({ noisy, options, throwOnError },
      ...params.concat([{ fields: this.defaultFields }]))
  }

  /**
   * create a folder
   */
  createFolder({ name, throwOnError = true, noisy, parentId = 'root' }) {
    return this.create({
      noisy,
      throwOnError,
      metadata: {
        name,
        mimeType: this.folderMimeType,
        parents: [parentId]
      }
    })
  }

  /**
   * delete a file
   */
  delete({ noisy, id }) {
    const fetcher = this._fileFetcher(id)
    return fetcher.fetch({
      options: {
        method: 'DELETE'
      }, noisy
    })
  }

  getTempName() {
    return `__canbedeleted__`
  }

  copy({ id, noisy, throwOnError }, ...params) {
    const fetcher = this._fileFetcher(id)
    return fetcher.fetch({
      path: '/copy',
      noisy,
      throwOnError,
      options: {
        method: "POST"
      }
    }, ...params.concat([{ fields: this.defaultFields }]))
  }

  updateMetadata({ id, metadata, noisy, throwOnError }, ...params) {
    const fetcher = this._fileFetcher(id)
    return fetcher.fetch({
      noisy,
      throwOnError,
      noCache: true,
      options: {
        method: 'PATCH',
        payload: JSON.stringify(metadata),
        mimeType: "application/json"
      }
    }, ...params.concat([{ fields: this.defaultFields }]))
  }

  /**
   * upload a file
   * @return {FetcherResponse}
   */
  upload({ blob, noisy, md5Name = true, throwOnError = true, mimeType, temp = true, parentId = null }, ...params) {


    const fetcher = this._plainFetcher(this.uploadEndpoint)

    // the name we'll write to storage cound be the md5
    const tempName = temp ? this.getTempName() : ''
    const name = tempName + (md5Name ? Exports.Utils.md5Checksum(blob) : blob.getName())
    if (noisy) console.log('..uploading', name)
    const metadata = temp ? { parents: ['appDataFolder'] } : parentId

    // the multipart boundary - could be anything
    const boundary = Exports.Utils.boundary()

    // make the multipart payload
    const payload = fetcher.makeMultiPart({
      name,
      blob,
      boundary,
      mimeType,
      metadata
    })

    // final options to upload data
    const options = {
      method: "POST",
      contentType: `multipart/related; boundary=${boundary}`,
      payload
    }

    // now do a multipart upload
    const upload = fetcher.fetch({ options, noisy, throwOnError },
      ...params.concat([{ fields: this.defaultFields }]))

    // inherit the blob
    upload.blob = blob
    return upload

  }

  /**
    * get all the files in a folder
    * @param {object} p
    * @param {string} [p.path='/'] the folder path
    * @param {boolean} [p.noisy] whether to log
    * @param {boolean} [p.throwOnError] whether to throw on error
    * @param {boolean} [p.noCache] whether to skip caching
    * @param {string} [p.query] additional query
    * @param {boolean} [p.recurse=false] whether to recurse through folders -  not implemented yet
    * @return {FetchResponse} the file result + a folder data property
    */
  getFilesInFolder({ path = '/', throwOnError, noisy, noCache, query, recurse = false }, ...params) {
    // sort out the folder path
    const result = this.getFolder({ noisy, noCache, throwOnError, path, createIfMissing: false }, ...params)
    if (result.error) return result

    const fileResult = this.list({ id: result.data.id, throwOnError, noisy, noCache, query }, ...params)
    return {
      ...fileResult,
      data: {
        files: !fileResult.error && fileResult.data.files.map(f => ({
          ...f,
          folder: result.data
        }))
      }
    }
  }


  /**
   * export a file
   * this applies to google files only
   * for other covnersions we need to get the blob and convert it
   * export file content by its id
   * @param {object} params
   * @param {string} params.id the file id
   * @param {string} [params.mimeType = this.defaultMimeType what to export as
   * @param {boolean} [params.noisy=false] whether to log
   * @param {boolean} [params.throwOnError] whether to throw on error
   * @param {boolean} [params.noCache] whether to skip caching
   * @return {FetchResponse} the file content
   */
  export({ id,
    mimeType = this.defaultMimeType,
    noisy = false,
    throwOnError,
    noCache
  }, ...params) {
    // first get the file metadata
    const metaResult = this.get({ id, noisy, throwOnError }, ...params)
    if (metaResult.error) return metaResult

    const fetcher = this._fileFetcher(id)
    const t = fetcher.fetch({
      path: '/export',
      noCache,
      noisy,
      throwOnError
    },
      ...params.concat([{ mimeType }]))

    if (t.error) return t

    // pass meta result of new file
    // exported data will be in the blob property
    if (t.data) {
      t.error = 'unexpected item in data area'

    } else {
      t.data = metaResult.data
    }

    return t
  }

  _plainFetcher(endpoint) {
    return Exports.newFetch({
      endpoint,
      tokenService: this.tokenService,
      defaultParams: this.defaultParams
    })
  }

  _fileFetcher(id) {
    if (Exports.Utils.isNU(id)) throw 'drive get id cannot be null or undefined'
    return this._plainFetcher(this.objectEndpoint.replace(':fileId', id))
  }


  /**
   * download a file
   * note  - this is not a multipart or resumable download
   * files for this use case will be fairly small
   * @param {object} params
   * @param {string} params.id the file id
   * @param {string} [params.download = false] whether to get a blob of the content
   * @param {boolean} [params.noisy=false] whether to log
   * @param {boolean} [params.throwOnError] whether to throw on error
   * @param {boolean} [params.noCache] whether to skip caching
   * @return {FetchResponse} the file content
   */
  download({ id, noisy = false, noCache = false, throwOnError }, ...params) {

    const t = this.get({ id, noisy, noCache, throwOnError, download: true }, ...params)
    if (t.error) return t

    // now do the download 
    const result = this._fileFetcher(t.data.id).fetch({
      noCache,
      noisy,
      throwOnError
    },
      ...params.concat([{ alt: 'media' }]))

    // inherit the metadata
    result.data = t.data
    return result

  }

  /**
   * get a file
   * note  - this is not a multipart or resumable download
   * files for this use case will be fairly small
   * @param {object} params
   * @param {string} params.id the file id
   * @param {boolean} [params.noisy=false] whether to log
   * @param {boolean} [params.throwOnError] whether to throw on error
   * @param {boolean} [params.noCache] whether to skip caching
   * @return {FetchResponse} the file content
   */
  get({ id, noisy = false, noCache = false, throwOnError }, ...params) {
    const u = Exports.Utils
    return this._fileFetcher(id).fetch({
      noCache,
      noisy,
      throwOnError
    },
      ...params.concat([{ fields: this.defaultFields }]))
  }

  list({ id, noCache, noisy, throwOnError, query, title }, ...params) {

    if (Exports.Utils.isNU(id)) throw 'folder list id cannot be null or undefined'
    const fetcher = this._plainFetcher(this.listEndpoint)

    return fetcher.fetch({
      noCache,
      noisy,
      throwOnError
    }, this.makeParentQuery({ parentId: id, title, query }), ...params)

  }

  /**
   * make a folder query involving a parent
   * @param {object} params
   * @param {string} params.parentId the parent parentId
   * @param {string} params.title the name of the folder
   * @param {string} params.query any additional query filters
   * @return {object} the query
   */
  makeParentQuery({ parentId, title, query }) {
    if (!parentId) throw 'parentId is missing for ' + title
    const q = [
      `'${parentId}' in parents`,
      title ? `name = '${title}'` : '',
      'trashed = false',
      query
    ].filter(f => f).join(" and ")
    return {
      q
    }
  }

  /**
   * make a mime parent query
   * @param {object} params
   * @param {string} params.parentId the parent parentId
   * @param {string} params.title the name of the file
   * @param {string} params.queries any additional query filters
   * @return {object} the query
   */
  makeQuery({ parentId, title }, ...queries) {
    const query = queries.filter(f => f).join(" and ")
    return this.makeParentQuery({ parentId, title, query })
  }

  /**
   * make a folder query
   * @param {object} params
   * @param {string} params.parentId the parent parentId
   * @param {string} params.title the name of the folder
   * @param {string} params.query any additional query filters
   * @return {object} the query
   */
  makeFolderQuery({ parentId, title, query }) {
    return this.makeQuery({ parentId, title }, query, `mimeType = '${this.folderMimeType}'`)
  }


  /**
   * create a metadata object
   * @param {object} params
   * @param {string} params.parentId the parent parentId
   * @param {string} params.mimeType file mimeType
   * @param {string} params.title file name
   * @return {object} metadata object
   */
  makeMetadata({ parentId, mimeType, title }) {
    return {
      name: title,
      parents: [parentId],
      mimeType
    }
  }

  /** 
   * get a folder metadata
   * @param {object} params
   * @param {string} params.parentId the parent parentId
   * @param {string} params.title the name of the folder
   * @params {boolean} params.createIfMissing create a folder if it doesn exist
   * @param {string} params.query any additional query filters
   * @return {PackResponse} the folder metadata
   */
  _getFolder({ parentId, title, createIfMissing, path, noisy, noCache, throwOnError }) {

    // if we're potentially writing, we want to make sure there's no caching to confuse things
    let result = this.list({
      noCache: noCache || createIfMissing,
      noisy,
      throwOnError,
      id: parentId,
      title,
      query: `mimeType = '${this.folderMimeType}'`
    })

    if (result.error) return result
    let { files } = result.data

    // if we're creating missing folders, then do that here
    if (!files.length && createIfMissing) {
      result = this.create({ noisy, throwOnError, metadata: this.makeMetadata({ parentId, title, mimeType: this.folderMimeType }) })
      if (result.error) return result
      files = result.data.files
    }


    // if we've created a folder in the meantime it's definition will be in files
    // and the result will be the result of setting the new folder
    if (!files || !files.length) {
      result.error = this.nf + ' - ' + path
    }
    return result
  }

  /** 
   * get a all the folders in a deconstructed path
   * @param {object} params
   * @param {string[]} params.titles the folder names deconstructed from a path
   * @params {boolean} params.createIfMissing create a folder if it doesn exist
   * @return {object} the folder metadata along the way
   */
  _getFolders({ titles, createIfMissing, throwOnError, noisy, noCache }) {
    // the titles should be an array of each path element

    // start here
    let parent = this.get({ id: 'root', noisy, throwOnError: true, noCache })

    // final result
    const folders = [{
      folder: parent.data,
      path: '',
      error: parent.error
    }]

    let i = 0
    while (i < titles.length && !parent.error) {

      const parentId = folders[0].folder.id

      const path = titles.slice(0, i + 1).join("/")
      const title = titles[i]
      if (title) {
        parent = this._getFolder({ parentId, title, createIfMissing, path, noisy, throwOnError })
      } else {
        parent.error = 'blank folder name not allowed'
      }
      if (!parent.error) {
        folders.splice(0, 0, {
          folder: parent.data.files[0],
          path,
          error: parent.error
        })
      }

      i++
    }

    return {
      folders,
      result: parent
    }


  }

  /** 
   * get folders  from a path
   * @param {object} params
   * @param {string} params.path the folder path
   * @params {boolean} params.createIfMissing  folders if it doesn exist
   * @return {FetchResponse} the folders metadata 
   */
  getFolders({ path, createIfMissing = false, throwOnError, noisy, noCache }) {
    // split the path into its components
    const u = Exports.Utils
    const titles = (!path || u.isNU(path)) ? [] : path.replace(/^\//, '').replace(/\/$/, '').split("/")
    const res = this._getFolders({ titles, createIfMissing, throwOnError, noisy, noCache })
    const p = (res.folders && res.folders[0] && res.folders[0]) || {}
    const r = {
      ...res.result,
      data: {
        folders: res.folders,
        ...p.folder,
        path: p.path
      }
    }
    return r
  }

  /** 
   * get folder  from a path
   * @param {object} params
   * @param {string} params.path the folder path
   * @params {boolean} params.createIfMissing  folders if it doesn exist
   * @return {FetchResponse} the folders metadata 
   */
  getFolder({ path, createIfMissing = false, throwOnError, noisy, noCache }) {
    const result = this.getFolders({ path, createIfMissing, throwOnError, noisy, noCache })
    if (result.error) return result
    return {
      ...result,
      data: {
        path,
        ...result.data.folders[0].folder
      }
    }
  }

  /** 
   * get file from a path
   * @param {object} params
   * @param {string} params.path the file path
   * @param {string} params.name the file name
   * @return {FetchResponse} the files metadata 
   */
  getFiles ({  name, ...options }) {
    return this.getFilesInFolder ({...options, query:`name = '${name}'`})
  }

}






