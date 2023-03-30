import {
    LiveObjectOptions,
    PropertyOptions,
    EventHandlerOptions,
    CallHandlerOptions,
} from './types'
import caller from './utils/caller'
import { readManifest, buildPropertyMetadata } from './utils/file'
import { camelToSnake } from './utils/formatters'

export function Spec(options: LiveObjectOptions): ClassDecorator {
    const callerFilePath = caller()
    const manifest = readManifest(callerFilePath)
    const propertyMetadata = buildPropertyMetadata(callerFilePath)

    return function (constructor: Function) {
        constructor.prototype._propertyMetadata = propertyMetadata
        constructor.prototype._options = options
        constructor.prototype._liveObjectNsp = manifest.namespace
        constructor.prototype._liveObjectName = manifest.name
        constructor.prototype._liveObjectVersion = manifest.version
        constructor.prototype._table =
            options.table || [manifest.namespace, camelToSnake(manifest.name)].join('.')
    }
}

export function Property(options: PropertyOptions = {}): PropertyDecorator {
    return function (object: any, propertyName: string | symbol) {
        object.constructor.prototype._propertyRegistry =
            object.constructor.prototype._propertyRegistry || {}
        object.constructor.prototype._propertyRegistry[propertyName] = {
            name: propertyName,
            options: options,
        }
    }
}

export function OnEvent(eventName: string, options: EventHandlerOptions = {}): PropertyDecorator {
    return function (object: any, methodName: string | symbol) {
        object.constructor.prototype._eventHandlers =
            object.constructor.prototype._eventHandlers || {}
        object.constructor.prototype._eventHandlers[eventName] = { methodName, options }
    }
}

export function OnAllEvents(): PropertyDecorator {
    return function (object: any, methodName: string | symbol) {
        object.constructor.prototype._beforeEventHandlers =
            object.constructor.prototype._beforeEventHandlers || []
        object.constructor.prototype._beforeEventHandlers.push(methodName)
    }
}

export function OnCall(functionName: string, options: CallHandlerOptions = {}): PropertyDecorator {
    return function (object: any, methodName: string | symbol) {
        object.constructor.prototype._callHandlers =
            object.constructor.prototype._callHandlers || {}
        object.constructor.prototype._callHandlers[functionName] = { methodName, options }
    }
}

export function OnAllCalls(): PropertyDecorator {
    return function (object: any, methodName: string | symbol) {
        object.constructor.prototype._beforeCallHandlers =
            object.constructor.prototype._beforeCallHandlers || []
        object.constructor.prototype._beforeCallHandlers.push(methodName)
    }
}
