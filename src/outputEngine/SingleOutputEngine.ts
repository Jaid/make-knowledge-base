import type {ContentModule} from 'src/contentModule/ContentModule.js'

import * as path from 'forward-slash-path'
import fs from 'fs-extra'
import {renderHandlebars} from 'zeug'

import {OutputEngine} from 'src/outputEngine/OutputEngine.js'

export class SingleOutputEngine extends OutputEngine {
  async run() {
    const templateFile = path.join(import.meta.dirname, 'single.html.hbs')
    const template = await fs.readFile(templateFile, 'utf8')
    const outputText = renderHandlebars(template, {
      pages: this.context.pages,
    }, {
      renderContentModule: (contentModule: ContentModule) => {
        return contentModule.asHtml()
      },
    })
    const outputFileStem = `${this.context.projectId}_knowledge_base`
    await this.outputHtmlFile(outputText, outputFileStem)
  }
}
