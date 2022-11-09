import { LiveObjectOptions } from './types'
import { DEFAULT_OPTIONS } from './liveObject'

export function Spec(options?: LiveObjectOptions): ClassDecorator {
    return function (constructor: Function) {
        options = { ...DEFAULT_OPTIONS, ...(options || {}) }
        constructor.prototype.options = options
        constructor.prototype.name = options.name || constructor.name
    }
}
