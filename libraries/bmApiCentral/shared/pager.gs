
const pager = ({
  nextFetch,
  limit = Infinity,
  pageSize = null,
  page = { items: [], pageToken: '', nItems: 0 },
  itemCounter,
  consolidate
}) => {

  consolidate = consolidate || ((page) => {
    return page.items.reduce((p, c) => {
      Reflect.ownKeys(c).forEach(f => {
        if (!p[f]) {
          p[f] = c[f]
        } else {
          if (Array.isArray(c[f])) {
            p[f] = p[f].concat(c[f])
          } else {
            p[f] = c[f]
          }
        }
      })
      return p
    }, {})
  })

  itemCounter = itemCounter || ((pack) => {
    const key = Reflect.ownKeys(pack.data).filter(f => Array.isArray(pack.data[f]))[0]
    return pack.data[key].length
  })


  const { pageToken, items, nItems } = page
  const pack = nextFetch(...[
    pageToken ? { pageToken } : null,
    (pageSize || limit !== Infinity) ? { pageSize: Math.min(limit - nItems, pageSize || Infinity) } : null].filter(f => f))

  if (pack.error) return pack.error

  items.push(pack.data)
  page.nItems += itemCounter(pack)
  page.pageToken = pack.data.nextPageToken
  if (!page.pageToken || page.nItems >= limit) {
    pack.data = consolidate(page)
    return pack
  } else {
    return pager({ nextFetch, itemCounter, consolidate, page })
  }

}
