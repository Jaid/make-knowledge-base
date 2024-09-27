import type {ContentModule} from 'src/contentModule/ContentModule.js'

import * as path from 'forward-slash-path'
import fs from 'fs-extra'
import {renderHandlebars} from 'zeug'

import {OutputEngine} from 'src/outputEngine/OutputEngine.js'

export class PagesOutputEngine extends OutputEngine {
  async run() {
    const templateFile = path.join(import.meta.dirname, 'pages.html.hbs')
    const template = await fs.readFile(templateFile, 'utf8')
    for (const [pageId, pageItems] of Object.entries(this.context.pages)) {
      const outputText = renderHandlebars(template, {
        contentModules: pageItems,
      }, {
        renderContentModule: (contentModule: ContentModule) => {
          return contentModule.asHtml()
        },
      })
      let outputFileStem = `${this.context.projectId}_knowledge`
      if (pageId) {
        outputFileStem += `_${pageId}`
      }
      await this.outputHtmlFile(outputText, outputFileStem)
    }
  }
}
