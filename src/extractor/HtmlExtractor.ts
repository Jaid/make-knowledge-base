import type {FirstParameter} from 'more-types'

import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer-core'

import debug from 'lib/debug.js'
import {HtmlContentModule} from 'src/contentModule/HtmlContentModule.js'
import {DownloadExtractor} from 'src/extractor/DownloadExtractor.js'

export type ExtraOptions = {
  domSelector?: string
  headless?: boolean
  puppeteer: boolean
  useTitle?: boolean
}

export class HtmlExtractor<ExtraOptionsGeneric = {}> extends DownloadExtractor<ExtraOptions & ExtraOptionsGeneric> {
  title: string | undefined
  getContentModule() {
    return new HtmlContentModule(this.entry, this.content, this.title)
  }
  async init() {
    if (!this.entry.puppeteer) {
      await super.init()
      if (this.entry.domSelector) {
        const cheerioPage = cheerio.load(this.content)
        this.content = cheerioPage(this.entry.domSelector).html() ?? ''
      }
    } else {
      const headless = this.entry.headless ?? true
      debug('Launching %s (%s) for %s', this.context.args.chromeExecutable, headless ? 'headless' : 'window', this.entry.url)
      const browser = await puppeteer.launch({
        executablePath: this.context.args.chromeExecutable,
        headless: true,
      })
      const page = await browser.newPage()
      for (const [name, value] of Object.entries(this.entry.cookies ?? {})) {
        const cookie = {
          name,
          path: '/',
          secure: true,
          domain: new URL(this.entry.url).hostname,
        } as FirstParameter<typeof page.setCookie>
        if (typeof value === 'string') {
          cookie.value = value
        } else {
          Object.assign(cookie, value)
        }
        await page.setCookie(cookie)
      }
      await page.goto(this.entry.url, {
        waitUntil: 'domcontentloaded',
      })
      try {
        await page.waitForNetworkIdle({
          idleTime: 1000,
          concurrency: 2,
          timeout: 60_000,
        })
      } catch (error) {
        throw new Error(`No network idle happened on ${this.entry.url} after 60 seconds`, {
          cause: error,
        })
      }
      if (this.entry.domSelector) {
        try {
          await page.waitForSelector(this.entry.domSelector, {
            timeout: 60_000,
          })
        } catch (error) {
          throw new Error(`No selector ${this.entry.domSelector} found on ${this.entry.url} after 60 seconds`, {
            cause: error,
          })
        }
      }
      const useTitle = this.entry.useTitle ?? true
      if (useTitle) {
        this.title = await page.title()
      }
      if (this.entry.domSelector) {
        const selectedElement = await page.$(this.entry.domSelector)
        this.content = await page.evaluate(element => element.innerHTML, selectedElement)
      } else {
        this.content = await page.content()
      }
      await browser.close()
    }
  }
}
