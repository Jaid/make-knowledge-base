import type {Promisable} from 'type-fest'

export type Options<ExtraOptions = {}> = ExtraOptions & {
}

export default abstract class Compressor<ExtraOptions = {}> {
  protected options: Options<ExtraOptions>
  constructor(options?: Options<ExtraOptions>) {
    this.options = {
      ...this.getDefaultOptions(),
      ...options,
    } as Options<ExtraOptions>
  }
  compress(code: string): Promisable<string> {
    return code
  }
  getDefaultOptions(): Partial<Options<ExtraOptions>> {
    return {}
  }
}
