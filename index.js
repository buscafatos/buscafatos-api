require('dotenv').config()

const puppeteer = require('puppeteer');
const parse = require('url-parse');
const { transform } = require("node-json-transform");
const express = require('express')
const app = express()
const port = 8000

const SEARCH_ENGINE_ID = process.env.SEARCH_ENGINE_ID;
const API_KEY = process.env.API_KEY;

let baseMap = {
  item: {
    totalResults: "queries.request.0.totalResults",
    searchTerms: "queries.request.0.searchTerms",
    count: "queries.request.0.count",
    startIndex: "queries.request.0.startIndex",
    items: "items"
  },
  operate: [
    {
      run: function(ary) { 
        return transform(ary, nestedMap);
      }, 
      on: "items"
    }
  ]
};

let nestedMap = {
  "item" : {
    "title": "title",
    "source": "displayLink",
    "htmlTitle": "htmlTitle",
    "link": "link",
    "snippet": "snippet",
    "htmlSnippet": "htmlSnippet",
    "thumbnail": "pagemap.cse_thumbnail.0.src"
  }
};

async function crawl(requestUrl) {

    const queryObject = parse(requestUrl, true).query;

    let fullUrl = `https://${queryObject.url}`;

    console.log(`crawling url = [${fullUrl}]`);

    // const browser = await puppeteer.launch();

    const browser = await puppeteer.launch({
        headless: true
    });
    const page = await browser.newPage();
    await page.goto(fullUrl, {waitUntil: 'domcontentloaded'});

    // let content = await page.content();
    const extractedText = await page.$eval('*', (el) => el.innerText);

    await browser.close();

    // console.log(content);

    return extractedText;
}

async function asyncHandler(requestUrl, query) {

    console.log('searchTerm = [%s] --- requestUrl = [%s]', query, requestUrl);

    const queryObject = parse(requestUrl, true).query;

    // console.log('last search term [%s]', query);

    // https://developers.google.com/custom-search/v1/overview
    // https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list#request

    let _url = new URL('https://www.googleapis.com/customsearch/v1/siterestrict');
    _url.searchParams.set('num', '10');
    _url.searchParams.set('safe', 'active');
    _url.searchParams.set('q', query);
    _url.searchParams.set('key', API_KEY);
    _url.searchParams.set('cx', SEARCH_ENGINE_ID);

    console.log(_url);

    // pagination
    if (queryObject.st) {
      let start = parseInt(queryObject.st);
      if (Number.isInteger(start))
      _url.searchParams.set('start', start);
    }

    // count
    if (queryObject.count) {
      let count = parseInt(queryObject.count);
      if (Number.isInteger(count))
      _url.searchParams.set('num', count);
    }

    // sort
    if (queryObject.sort) {
      _url.searchParams.set('sort', queryObject.sort);
    }      


    const resp = await fetch(_url, {
      headers: {
        accept: "application/json",
      },
    });

    // raw json from google
    if (queryObject.raw && '1' == queryObject.raw) {

      return resp.body;

    } else {
      // simpler transformed json

      let json = await resp.json();
      // console.log(json);
      let _result = transform(json, baseMap);
      // console.log(_result);
      return _result;

    }
}

app.get('/', (req, res) => {
  res.send('Hello World!')
})


app.get('/v1/search/:query', async (req, res) => {
  let fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  let _json = await asyncHandler(fullUrl, req.params.query);
  res.json(_json);
})

app.get('/v1/crawl', async (req, res) => {
  let fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  let _json = await crawl(fullUrl);
  res.send(_json);
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})