class Speech {

  constructor({
    projectNumber,
    tokenService,
    locationId = 'eu',
    fieldMask,
    apiKey,
    voice,
    gcsUri,
    audioConfig,
    noCache = false,
    noisy = false
  } = {}) {
    // sync
    // https://texttospeech.googleapis.com/v1/text:synthesize

    // operations
    // https://texttospeech.googleapis.com/v1/{parent=projects/*/locations/*}
    this.endpoint = "https://texttospeech.googleapis.com/v1"
    this.tokenService = tokenService
    this.projectNumber = projectNumber
    this.locationId = locationId
    this.voice = {
      languageCode: "en-US",
      ...voice
    }
    this.gcsUri = gcsUri
    this.audioConfig = {
      audioEncoding: 'MP3',
      ...audioConfig
    }
    this.noCache = noCache
    this.noisy = noisy
    this.basePayload = {
    }
    if (fieldMask) {
      if (!Array.isArray(fieldMask)) throw 'fieldmask must be an array'
      this.basePayload.fieldMask = fieldMask.join(",")
    }

    // use this fetcher with a shortish cache life for getting processors
    const fetchOptions = {
      endpoint: this.endpoint,
      tokenService: this.tokenService,
      defaultParams: apiKey ? { key: apiKey } : null
    }

    this.fetcher = Exports.newFetch(fetchOptions)

  }

  get syncProcessEndpoint() {
    return '/text:synthesize'
  }



  getVoice(voice = {}) {
    return {
      voice: {
        ...this.voice,
        ...voice
      }
    }
  }

  getOutputGcsUri(gcsUri = this.gcsUri) {
    return {
      gcsUri
    }
  }


  getSynthesesInput({ ssml, text }) {
    if (ssml && text) throw 'Provide either ssml or text property only as input'
    if (!ssml && !text) throw 'Provide either ssml or text property as input - there was neither'
    const input = ssml ? { ssml } : { text }
    return {
      input
    }
  }

  getAudioConfig(audioConfig = {}) {
    // this ping is really just to allow any defaults to be set from the constructor as a future enhancement
    return {
      audioConfig: {
        audioEncoding: "MP3",
        ...this.audioConfig,
        ...audioConfig
      }
    }
  }

  /**
   * synthesize audio 
   * @return {Operation}  and operation response
   */
  synthesize(input, { audioConfig, voice } = {}, { noCache = this.noCache, noisy = this.noisy } = {}) {
    const payload = {
      ...this.getSynthesesInput(input),
      ...this.getAudioConfig(audioConfig),
      ...this.getVoice(voice)
    }

    // https://texttospeech.googleapis.com/v1/{parent=projects/*/locations/*}:synthesizeLongAudio
    const result = this._post({
      noCache,
      noisy,
      processEndpoint: this.endpoint + this.syncProcessEndpoint,
      payload
    })

    return {
      ...result,
      mp3: Exports.Utils.b64ToBlob(result.data.audioContent, 'audio/mpeg')
    }

  }

  // not implelemted yet

  /**
   * synthesize audio in batch
   * @return {Operation}  and operation response
   */
  synthesizeLongAudio(input, { audioConfig, gcsUri, voice } = {}, { noCache, noisy } = {}) {
    const payload = {
      ...this.getSynthesesInput(input),
      ...this.getAudioConfig(audioConfig),
      ...this.getOutputGcsUri(gcsUri),
      ...this.getVoice(voice)
    }

    // https://texttospeech.googleapis.com/v1/{parent=projects/*/locations/*}:synthesizeLongAudio
    const result = this._post({
      noCache,
      noisy,
      processEndpoint: '',
      payload,
      type: "synthesizeLongAudio"
    })

    return result

  }


  _post({
    noCache = false,
    noisy = false,
    processEndpoint,
    payload,
    type
  }) {

    const cacher = this.fetcher.cacher
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
    const url = type ? processEndpoint.replace(/(.*):(.*$)/, `$1${type}`) : processEndpoint

    // args for the fetcher
    const args = {
      options,
      noCache,
      noisy,
      keyer,
      url
    }


    // do the fetch - the result is base64 encoded
    return this.fetcher.fetch(args)
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


