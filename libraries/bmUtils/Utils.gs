/**
 * mainly we'll have Apps Script specific utilities stuff in here to make it easier to migrate to another package
 */

const Utils = (() => {

  const isNull = (value) => value === null
  const isNU = (value) => isNull(value) || isUndefined(value)
  const isUndefined = (value) => typeof value === typeof undefined

  const singleSlash = (url) => {
    const s = url.replace(/\/+/g, '/')
    return s === '/' ? '' : s
  }

  /**
   * color manip = required to decide whether to use a light or dark font given a background
   * adapted from https://24ways.org/2010/calculating-color-contrast/
   */
  const getContrast = (color) => {
    const { r, g, b } = getRgb(color)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
    return yiq >= 128 ? '#212121' : '#ffffff'
  }

  /**
   * create a key from arbitrary args
   * @param {...*} var_args
   * return {string}
   */
  digester = (...args) => {
    // conver args to an array and digest them
    const t = args.map(function (d) {
      if (typeof d === typeof undefined) throw new Error('digester key component cant be undefined')
      return (Object(d) === d) ? JSON.stringify(d) : d.toString();
    }).join("-")
    const s = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, t, Utilities.Charset.UTF_8)
    return Utilities.base64EncodeWebSafe(s)
  }

  // assume color is #hhhhhh
  const getRgb = (color) => ({
    r: parseInt(color.substr(1, 2), 16),
    g: parseInt(color.substr(3, 2), 16),
    b: parseInt(color.substr(5, 2), 16)
  })


  const isDate = (text) => {
    const date = new Date(text);
    return date instanceof Date && !isNaN(date.valueOf())
  }


  /**
   *
   * @param {string} str b64 string to decompress
   * @return {object} original object
   */
  const decompress = (str) => {
    return JSON.parse(Utilities.unzip(Utilities.newBlob(Utilities.base64Decode(str), 'application/zip'))[0].getDataAsString())
  }
  const percent = (value, base, places = 1) => {
    return base ? (100 * value / base).toFixed(places) : base.toFixed(places)
  }

  const trunk = (str, maxLength = 100) => {
    if (typeof str === 'string') {
      return (str.length > maxLength) ? str.slice(0, maxLength) + '...' : str;
    }
    return str
  };
  /**
   *
   * @param {object} obj b64 to compress
   * @return {string} compressed string
   */
  const compress = (obj) =>
    Utilities.base64Encode(Utilities.zip([Utilities.newBlob(JSON.stringify(obj))]).getBytes())

  const bytesToHex = (bytes) =>
    bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('')

  const b64ToHex = (b64) => bytesToHex(Utilities.base64Decode(b64, Utilities.Charset.UTF_8))
  const blobToB64 = (blob) => Utilities.base64Encode(blob.getBytes())
  const b64ToBlob = (b64, contentType, name) =>
    Utilities.newBlob(Utilities.base64Decode(b64, Utilities.Charset.UTF_8), contentType, name)
  const newBlob = (content, contentType, name) => Utilities.newBlob(content, contentType, name)
  const toBytes = (text) => Utilities.newBlob(text).getBytes()
  const uuid = () => Utilities.getUuid()
  const blobToCache = (blob) => ({
    b64: blobToB64(blob),
    contentType: blob.getContentType(),
    name: blob.getName(),
  })
  const cacheToBlob = ({ b64, contentType, name }) => b64ToBlob(b64, contentType, name)
  const cacheBlob = (blob) => compress(blobToCache(blob))
  const unCacheBlob = (cache) => cacheToBlob(decompress(cache))

  const blobToObject = (blob) => JSON.parse(blob.getDataAsString())
  const explodeParams = (params) => {
    return Array.from(params.flat(Infinity).reduce((p, c) => {

      Object.keys(c).forEach(k => {
        let value = c[k]
        if (typeof c[k] === 'object') {
          // its possible we have something like this
          // { filter: {type:'aa', x: 'y'}} 
          value = Object.keys(c[k]).reduce((p, o) => {
            p.push(o + '=' + c[k][o])
            return p
          }, []).join(" AND ")
        }
        p.push([k, value])
      })
      return p
    }, [])
      .reverse()
      .reduce((p, c) => {
        if (p.has(c[0])) {
          // join the values with commas
          const v = Array.from(new Set(p.get(c[0]).split(",").concat(c[1].split(","))))
          p.set(c[0], v.join(","))
        } else {
          p.set(c[0], c[1])
        }
        return p
      }, new Map())).sort((a, b) => {
        if (a[0] === b[0]) return 0
        if (a[0] > b[0]) return 1
        return -1
      }).map(([k, v]) => [k, encoder(v)])
  }

  const addParams = (params) => {
    params = arrify(params).flat(Infinity)
    const pars = explodeParams(params).map(f => f.join("="))
    return pars.length ? `?${pars.join('&')}` : ''
  }

  const arrify = (item) => Array.isArray(item) ? item : (isNU(item) ? [] : [item])

  const encoder = (str) => {
    return encodeURIComponent(str)
  }

  const isObject = (obj) => obj === Object(obj);
  const isBlob = (blob) => isObject(blob) && blob.toString() === 'Blob'
  const isArray = (item) => Array.isArray(item)
  const isByteArray = (item) => isArray(item) && !isUndefined(item.byteLength)
  const isNumber = (item) => typeof item === "number"
  const isBoolean = (item) => typeof item === "boolean"
  const isString = (item) => typeof item === "string"
  const isFunction = (item) => typeof item === "function"

  const md5FromText = (text) => md5Checksum(newBlob (text))
  const md5Checksum = (blob) => bytesToHex(md5FromBytes(blob.getBytes()))
  const md5FromBytes = (bytes) =>
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes)


  const sleep = (ms) => Utilities.sleep(ms)
  const dedup = (items, key) => Array.from(new Map(items.map(f => [f[key], f])).values())
  const blobToDataUri = (blob) => `data:${blob.getContentType()};base64,${blobToB64(blob)}`
  const isHttps = (s) => Boolean(isString(s) && s.match(/^https:\/\/.*/))
  const obify = ({ data, fields }) => fields.reduce((p, c) => {
    if (Reflect.has(p, c)) throw `repeated obify key ${c}`
    if (!isUndefined(data[c])) p[c] = data[c]
    return p
  }, {})


  const obSorter = ({ fields, data, validateProperties }) => {

    const fieldSorter = (rowa, rowb) => {

      const guarda = validateProperties ? new Proxy(rowa, validateProperties) : rowa
      const guardb = validateProperties ? new Proxy(rowb, validateProperties) : rowb

      const compare = (a, b) => {

        // they are just equal
        if (a === b) return 0

        // If we get this far, if there are any nulls, only one of them can be
        if (isNull(a)) return -1
        if (isNull(b)) return 1

        // if we are not validating properties, then undefined is a valid value, which we'll treat as '' (as per spreadsheet norm)
        if (!validateProperties && isUndefined(a)) a = ''
        if (!validateProperties && isUndefined(b)) b = ''

        // basic number
        if (isNumber(a) && isNumber(b)) return a - b

        // can we do a string compare
        if (isObject(a) && Reflect.has(a, "localeCompare")
          && isObject(b) && Reflect.has(b, "localeCompare")) return a.localeCompare(b)

        // perhaps they smell like a date
        if (isDate(a) && isDate(b))
          return new Date(a).getTime() - new Date(b).getTime()

        // this might happen with semi-dates
        if (isFunction(a.toString) && isFunction(b.toString))
          return a.toString().localeCompare(b.toString())

        throw `cant compare ${typeof a} with ${typeof b}`

      }

      let index = 0
      let result = 0
      while (index < fields.length && !result) {
        const field = fields[index]
        const isob = isObject(field)
        const descending = isob && field.descending
        const name = isob ? field.name : field
        result = descending ? compare(guardb[name], guarda[name]) : compare(guarda[name], guardb[name])
        index++
      }
      return result
    }
    return data.sort(fieldSorter)
  }


  const textCleaner = (str) => str.replace(/[\r\n:\/]/mg, " ")
    .replaceAll("//", " ")
    .replace(/\s+/, " ")
    .trim()

  const flummer = ({ size = 4, numberOfWords = 3, sep = '-' } = {}) => {
    const vowels = 'aeiou'.split('')
    const consonants = 'bcdfghjklmnprstvwzy'.split('')
    const getRandItem = (arr) => arr[Math.floor(Math.random() * arr.length)]
    const addNextChar = (word) => word.concat([getRandItem(vowels.includes(word.at(-1)) ? consonants : vowels)])
    return Array.from({ length: numberOfWords }, () => {
      let word = [getRandItem(getRandItem([vowels, consonants]))]
      while (word.length < size) word = addNextChar(word)
      return word
    }).map(f => f.join("")).join(sep)
  }

  const chunker = (inputArray, size) => {
    const chunks = []
    const items = inputArray.slice()
    while (items.length) chunks.push(items.splice(0, size))
    return chunks
  }

  const flubber = ({ text, size = 4, numberOfWords = 3, sep = '-' }) => {
    const u = Exports.Utils

    // use this as index to make the thing recreatable
    const md5Checksum = u.md5Checksum(u.newBlob(text))
    const seeds = chunker(md5Checksum.split(''), 2).map(s => parseInt(s.join(''), 16) & 0x7f).flat(Infinity)
    const charsRequired = size * numberOfWords

    // little bit of bias for letter popularity should make it more readable
    const vowels = 'aeiou'.split('')
    const consonants = 'bcdfghjklmnprstvwxyz'.split('')
    const isOdd = (n) => n % 2

    return chunker(Array.from({ length: charsRequired }).reduce((p, c, i) => {
      const subject = seeds[i % seeds.length]
      const previous = p.at(-1)
      const nextConsonant = consonants[subject % consonants.length]
      const nextVowel = vowels[subject % vowels.length]

      // no more than 2 of the same time - default mix it up a bit
      let nextChar = isOdd(subject) ? nextConsonant : nextVowel

      // don't allow more than 2 of the same time
      // and only occassionally
      const exception = subject < 9

      if (previous && !exception) {
        if (vowels.includes(previous) && vowels.includes(nextChar)) {
          nextChar = nextConsonant
        } else if (consonants.includes(previous) && consonants.includes(nextChar)) {
          nextChar = nextVowel
        }
      }

      p.push(nextChar)
      return p
    }, []), size)
      .map(s => s.join('')).join("-")


  }

  return {
    md5FromText,
    flubber,
    chunker,
    flummer,
    textCleaner,
    obSorter,
    obify,
    isHttps,
    blobToDataUri,
    isObject,
    bytesToHex,
    blobToObject,
    arrify,
    addParams,
    isDate,
    blobToB64,
    uuid,
    boundary: uuid,
    toBytes,
    md5Checksum,
    sleep,
    isHttpOk: (code) => Math.floor(code / 100) === 2,
    newBlob,
    b64ToBlob,
    blobToCache,
    compress,
    decompress,
    cacheBlob,
    unCacheBlob,
    dedup,
    isUndefined,
    isNull,
    isNU,
    percent,
    trunk,
    getContrast,
    singleSlash,
    encoder,
    digester,
    b64ToHex,
    isBlob,
    isNumber,
    isByteArray,
    isBoolean,
    isString,
    isArray,
    isFunction,
    elapsedSecs: (start, finish) => Math.round((new Date().getTime(finish) - new Date(start).getTime()) / 1000)
  }
})()



