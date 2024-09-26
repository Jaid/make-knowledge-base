import CssCompressor from 'lib/package/compress-for-llm/compressor/CssCompressor.js'
import HtmlCompressor from 'lib/package/compress-for-llm/compressor/HtmlCompressor.js'
import JsonCompressor from 'lib/package/compress-for-llm/compressor/JsonCompressor.js'
import PythonCompressor from 'lib/package/compress-for-llm/compressor/PythonCompressor.js'
import TextCompressor from 'lib/package/compress-for-llm/compressor/TextCompressor.js'

export default {
  Text: TextCompressor,
  Html: HtmlCompressor,
  Python: PythonCompressor,
  Json: JsonCompressor,
  Css: CssCompressor,
}
