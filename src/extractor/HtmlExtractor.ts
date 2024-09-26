import type {FirstParameter} from 'more-types'

import * as cheerio from 'cheerio'
import * as path from 'forward-slash-path'
import fs from 'fs-extra'
import puppeteer from 'puppeteer-core'

import {HtmlContentModule} from 'src/make_knowledge_base/contentModule/HtmlContentModule.js'
import {DownloadExtractor} from 'src/make_knowledge_base/extractor/DownloadExtractor.js'

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
        if (this.context.options.debug) {
          const rawHtmlFile = path.join(this.context.tempFolder, `debug`, `${this.context.id}.html`)
          this.context.log(`Writing raw HTML to ${rawHtmlFile}`)
          await fs.outputFile(rawHtmlFile, this.content)
        }
        const cheerioPage = cheerio.load(this.content)
        this.content = cheerioPage(this.entry.domSelector).html() ?? ``
      }
    } else {
      const headless = this.entry.headless ?? true
      const browser = await puppeteer.launch({
        args: [
          `--no-sandbox`,
          `--disable-setuid-sandbox`,
          `--font-render-hinting=medium`,
          `--enable-font-antialiasing`,
        ],
        executablePath: this.context.options.chromeExecutable,
        headless: headless,
      })
      const page = await browser.newPage()
      for (const [name, value] of Object.entries(this.entry.cookies ?? {})) {
        const cookie = {
          name,
          path: `/`,
          secure: true,
        } as FirstParameter<typeof page.setCookie>
        if (typeof value === `string`) {
          cookie.value = value
        } else {
          Object.assign(cookie, value)
        }
        await page.setCookie(cookie)
      }
      await page.goto(this.entry.url, {
        waitUntil: `domcontentloaded`,
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
