import { LiveObjectOptions } from './types'
import { DEFAULT_LIVE_OBJECT_OPTIONS } from './liveObject'
import { DEFAULT_PROPERTY_OPTIONS } from './property'

export function Spec(options?: LiveObjectOptions): ClassDecorator {
    return function (constructor: Function) {
        options = { ...DEFAULT_LIVE_OBJECT_OPTIONS, ...(options || {}) }
        constructor.prototype.options = options
        constructor.prototype.name = constructor.name
    }
}

export function Property(options?: LiveObjectOptions): PropertyDecorator {
    return function (object: any, propertyName: string | symbol) {
        options = { ...DEFAULT_PROPERTY_OPTIONS, ...(options || {}) }
        // ...
    }
}
