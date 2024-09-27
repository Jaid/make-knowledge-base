import type {Response} from 'got'
import type {Dict} from 'more-types'

import * as path from 'forward-slash-path'
import fs from 'fs-extra'
import got from 'got'

import {Extractor} from 'src/extractor/Extractor.js'

type ExtraOptions = {
  cookies?: Dict<Dict | string>
  method?: 'get'
  url: string
}

export class DownloadExtractor<ExtraOptionsGeneric = {}> extends Extractor<ExtraOptions & ExtraOptionsGeneric> {
  response: Response<string>
  getDownloadUrl() {
    return this.entry.url
  }
  getExtension() {
    const url = this.getDownloadUrl()
    return path.extension(url)
  }
  getExtensionNormalized() {
    const extension = this.getExtension()?.toLowerCase()
    if (!extension) {
      return
    }
    if (extension === 'markdown') {
      return 'md'
    }
    if (extension === 'htm') {
      return 'html'
    }
    if (extension === 'jpeg') {
      return 'jpg'
    }
    if (extension === 'yaml') {
      return 'yml'
    }
    return extension
  }
  async init() {
    const url = this.getDownloadUrl()
    if (path.isAbsolute(url)) {
      this.logVerbose(`File ${url}`)
      this.content = await fs.readFile(url, 'utf8')
    } else {
      this.logVerbose(url)
      this.response = await got({
        url,
        method: this.entry.method ?? 'get',
      })
      this.content = this.response.body
    }
  }
}
