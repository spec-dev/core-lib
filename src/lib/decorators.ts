import {
    LiveObjectOptions,
    PropertyOptions,
    EventHandlerOptions,
    CallHandlerOptions,
} from './types'
import caller from './utils/caller'
import { readManifest, buildPropertyMetadata } from './utils/file'

export function Spec(options: LiveObjectOptions): ClassDecorator {
    const callerFilePath = caller()
    const manifestPromise = readManifest(callerFilePath)
    const propertyMetadataPromise = buildPropertyMetadata(callerFilePath)
    return function (constructor: Function) {
        constructor.prototype._options = options
        constructor.prototype._manifestPromise = manifestPromise
        constructor.prototype._propertyMetadataPromise = propertyMetadataPromise
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
        if (options.signature && !eventName.includes('@')) {
            eventName += `@${options.signature}`
        }
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
        if (options.signature && !functionName.includes('@')) {
            functionName += `@${options.signature}`
        }
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
