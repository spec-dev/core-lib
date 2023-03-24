import { LiveObjectOptions, PropertyOptions, EventHandlerOptions } from './types'
import caller from './utils/caller'
import { readJsonFile } from './utils/file'
import { camelToSnake } from './utils/formatters'
import { Reflect } from './utils/reflect'

export function Spec(options: LiveObjectOptions): ClassDecorator {
    const callerFilePath = caller()
    const callerDirComps = callerFilePath.split('/')
    callerDirComps.pop()
    const callerDirPath = callerDirComps.join('/')
    const manifest = readJsonFile(`${callerDirPath}/manifest.json`)

    return function (constructor: Function) {
        constructor.prototype.options = options
        constructor.prototype.namespace = manifest.namespace
        constructor.prototype.name = manifest.name
        constructor.prototype.version = manifest.version
        constructor.prototype.table =
            options.table || [manifest.namespace, camelToSnake(manifest.name)].join('.')
    }
}

export function Property(options: PropertyOptions = {}): PropertyDecorator {
    return function (object: any, propertyName: string | symbol) {
        object.constructor.prototype.propertyRegistry =
            object.constructor.prototype.propertyRegistry || {}
        object.constructor.prototype.propertyRegistry[propertyName] = {
            name: propertyName,
            metadata: Reflect.getMetadata('design:type', object, propertyName) || {},
            options: options,
        }
    }
}

export function OnEvent(eventName: string, options: EventHandlerOptions = {}): PropertyDecorator {
    return function (object: any, methodName: string | symbol) {
        object.constructor.prototype.eventHandlers =
            object.constructor.prototype.eventHandlers || {}
        object.constructor.prototype.eventHandlers[eventName] = { methodName, options }
    }
}

export function OnAllEvents(): PropertyDecorator {
    return function (object: any, methodName: string | symbol) {
        object.constructor.prototype.beforeEventHandlers =
            object.constructor.prototype.beforeEventHandlers || []
        object.constructor.prototype.beforeEventHandlers.push(methodName)
    }
}
