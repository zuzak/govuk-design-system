/* global XMLHttpRequest */
import accessibleAutocomplete from 'accessible-autocomplete'
import lunr from 'lunr'

// object.watch polyfill by Eli Grey
// Public Domain.
// eslint-disable-next-line
Object.prototype.watch||Object.defineProperty(Object.prototype,"watch",{enumerable:!1,configurable:!0,writable:!1,value:function(e,t){var r=this[e],n=r;delete this[e]&&Object.defineProperty(this,e,{get:function(){return n},set:function(c){return r=n,n=t.call(this,e,r,c)},enumerable:!0,configurable:!0})}}),Object.prototype.unwatch||Object.defineProperty(Object.prototype,"unwatch",{enumerable:!1,configurable:!0,writable:!1,value:function(e){var t=this[e];delete this[e],this[e]=t}});

var searchIndex = null
var documentStore = null
var timeout = 10 // Time to wait before giving up fetching the search index

// XHR client readyStates constants
var STATE_UNSENT = 0
var STATE_DONE = 4

// store status and message to track progress of the request
// a provide feedback to the user
var status = {
  state: STATE_UNSENT,
  message: null
}

var search = {
  fetchSearchIndex: function (callback) {
    var request = new XMLHttpRequest()
    request.open('GET', '/search-index.json', true)
    request.timeout = timeout * 1000
    status.message = 'Loading search index'
    request.onreadystatechange = function () {
      if (request.readyState === STATE_DONE) {
        if (request.status === 200) {
          var response = request.responseText
          var json = JSON.parse(response)
          callback(json)
          status.message = 'No results found'
          status.state = STATE_DONE
        } else {
          status.message = 'Failed to load the search index'
          // Log to analytics?
        }
      }
    }
    request.open('GET', '/search-index.json', true)
    request.send()
  },
  searchEngine: function (query, callback) {
    function runQuery () {
      var matchedResults = []
      if (!searchIndex || !documentStore) {
        return callback(matchedResults)
      }
      var searchTerm = query.toLowerCase()
      var searchResults = searchIndex.query(function (q) {
        q.term(searchTerm, { wildcard: lunr.Query.wildcard.TRAILING })
      })
      matchedResults = searchResults.map(function (result) {
        return documentStore[result.ref]
      })
      callback(matchedResults)
    }
    // watch for XMLHttpRequest status and return the query when status changes
    // on slow connections we want to run the typed query when index has
    // finished downloading
    status.watch('state', function () {
      runQuery()
    })

    runQuery()
  },
  handleOnConfirm: function (result) {
    var path = result.path
    if (path) {
      window.location.pathname = path
    }
  },
  inputValueTemplate: function (result) {
    return result && result.title
  },
  resultTemplate: function (result) {
    // add rest of the data here to build the item
    var itemTemplate = result && result.title
    return itemTemplate
  },
  init: function (container, input) {
    if (!document.querySelector(container)) {
      return
    }
    var self = this
    accessibleAutocomplete({
      element: document.querySelector(container),
      id: input,
      cssNamespace: 'app-site-search',
      displayMenu: 'overlay',
      placeholder: 'Search Design System',
      confirmOnBlur: false,
      autoselect: true,
      source: self.searchEngine,
      onConfirm: self.handleOnConfirm,
      templates: {
        inputValue: self.inputValueTemplate,
        suggestion: self.resultTemplate
      },
      tNoResults: function () { return status.message }
    })
    self.fetchSearchIndex(function (results) {
      searchIndex = lunr.Index.load(results.index)
      documentStore = results.store
    })
  }
}
export default search
