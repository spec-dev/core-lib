import { LiveObjectOptions, PropertyOptions, EventHandlerOptions } from './types'
import 'reflect-metadata'

export const DEFAULT_LIVE_OBJECT_OPTIONS = {}
export const DEFAULT_PROPERTY_OPTIONS = {}
export const DEFAULT_EVENT_HANDLER_OPTIONS = {}

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
        object.constructor.prototype.propertyRegistry =
            object.constructor.prototype.propertyRegistry || {}
        object.constructor.prototype.propertyRegistry[propertyName] = {
            name: propertyName,
            metadata: Reflect.getMetadata('design:type', object, propertyName) || {},
            options,
        }
    }
}

export function On(eventName: string, options?: EventHandlerOptions): PropertyDecorator {
    return function (object: any, methodName: string | symbol) {
        options = { ...DEFAULT_EVENT_HANDLER_OPTIONS, ...(options || {}) }
        object.constructor.prototype.eventHandlers =
            object.constructor.prototype.eventHandlers || {}
        object.constructor.prototype.eventHandlers[eventName] = { methodName, options }
    }
}

export function BeforeOn(): PropertyDecorator {
    return function (object: any, methodName: string | symbol) {
        object.constructor.prototype.beforeEventHandlers =
            object.constructor.prototype.beforeEventHandlers || []
        object.constructor.prototype.beforeEventHandlers.push(methodName)
    }
}
