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

export default items
