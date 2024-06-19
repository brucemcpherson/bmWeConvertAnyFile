/**
 * Information about the claim.
 * typedef  {object} FactClaim 
 * @property {string} claimant A person or organization stating the claim
 * @property {FactClaimReview[]} claimReview One or more reviews of this claim (namely, a fact-checking article)
 * @property {string} claimDate The date that the claim was made
 * @property {string} text The claim text. For instance: "Crime has doubled in the last 2 years."
 */

/**
 * Information about a claim review
 * typedef  {object} FactClaimReview 
 * @property {string} title The title of this claim review, if it can be determined
 * @property {string} url The URL of this claim review.
 * @property {string} reviewDate The date the claim was reviewed
 * @property {FactClaimPublisher} publisher The publisher of this claim review."
 * @property {string} languageCode The language this review was written in. For instance, \"en\" or \"de\
 * @property {string} textualRating Textual rating. For instance, \"Mostly false\"."
 */

class Fact {

  constructor({
    tokenService,
    apiKey
  } = {}) {
    this.endpoint = "https://factchecktools.googleapis.com"

    this.processFetcher = Exports.newFetch({
      defaultParams: apiKey ? { key: apiKey } : null,
      tokenService,
      // 23 hours
      expiry: 60 * 60 * 23,
      allowCaching: ["GET"],
      endpoint: this.endpoint
    })

  }

  search({ query = "Elvis is alive", languageCode = "en", noCache, noisy, limit } = {}, ...params) {

    const nextFetch = (...pageParams) => this._get({
      noCache,
      noisy,
      processEndpoint: "/v1alpha1/claims:search"
    }, ...params.concat(pageParams, [{ query }, { languageCode }]))


    return Exports.pager({ nextFetch, limit })
  }

  _get({
    noCache = false,
    noisy = false,
    processEndpoint
  }, ...params) {

    if (!processEndpoint) throw 'processendpoint not specified'


    // fetcher options
    const options = this.getOptions()


    // args for the fetcher
    const args = {
      options,
      noCache,
      noisy,
      path: processEndpoint
    }


    // do the fetch
    return this.processFetcher.fetch(args, ...params)
  }

  /**
   * get the fetch options
   */
  getOptions(options = {}) {
    return {
      method: "GET",
      contentType: "application/json; charset=utf-8",
      ...options
    }
  }


}

