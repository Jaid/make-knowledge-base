import {Tiktoken} from 'tiktoken/lite'

import encoder from '~/node_modules/tiktoken/encoders/o200k_base.js'

const getTokenSize = (text: string) => {
  // @ts-expect-error TS2339
  // eslint-disable-next-line typescript/no-unsafe-argument
  const tiktoken = new Tiktoken(encoder.bpe_ranks, encoder.special_tokens, encoder.pat_str)
  const tokens = tiktoken.encode(text)
  const size = tokens.length
  tiktoken.free()
  return size
}

export default getTokenSize
