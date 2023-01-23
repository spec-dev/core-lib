import { LiveObjectOptions, PropertyOptions, EventHandlerOptions } from './types'
import { DEFAULT_LIVE_OBJECT_OPTIONS } from './liveObject'
import { DEFAULT_PROPERTY_OPTIONS } from './property'
import { DEFAULT_EVENT_HANDLER_OPTIONS } from './eventHandler'

export function Spec(options: LiveObjectOptions): ClassDecorator {
    return function (constructor: Function) {
        options = { ...DEFAULT_LIVE_OBJECT_OPTIONS, ...(options || {}) }
        constructor.prototype.options = options
        constructor.prototype.name = constructor.name
        constructor.prototype.table = options.table
    }
}

export function Property(options?: PropertyOptions): PropertyDecorator {
    return function (object: any, propertyName: string | symbol) {
        options = { ...DEFAULT_PROPERTY_OPTIONS, ...(options || {}) }
        // ...
    }
}

export function On(eventName: string, options?: EventHandlerOptions): PropertyDecorator {
    return function (object: any, propertyName: string | symbol) {
        options = { ...DEFAULT_EVENT_HANDLER_OPTIONS, ...(options || {}) }
        object.constructor.prototype.eventHandlers =
            object.constructor.prototype.eventHandlers || {}
        object.constructor.prototype.eventHandlers[eventName] = propertyName
    }
}
