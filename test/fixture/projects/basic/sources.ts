import type {Entries} from 'src/run.js'

const items: Entries = {}
items.ponyTutorial = {
  page: 'rentry',
  type: 'rentry',
  target: 'fluffscaler-pdxl',
}
items.loraMakingGuide = {
  page: 'civitai',
  type: 'civitai_article',
  target: 4,
  cookies: {
    '__Secure-civitai-token': {
      value: process.env.CIVITAI_TOKEN,
    },
  },
}
items.kohyaHtml = {
  page: 'kohya',
  type: 'repo_glob',
  extractor: 'htmlFromMarkdown',
  target: {
    owner: 'kohya-ss',
    repo: 'sd-scripts',
    branch: 'sd3',
    pattern: [
      'docs/train_SDXL-en.md',
      'docs/masked_loss_README.md',
    ],
  },
}
items.kohyaMarkdown = {
  ...items.kohyaHtml,
  extractor: 'markdown',
}

export default items
