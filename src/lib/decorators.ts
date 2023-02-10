import { LiveObjectOptions, PropertyOptions, EventHandlerOptions, StringKeyMap } from './types'
import 'reflect-metadata'
import { dir, read } from './utils/file'
import path from 'node:path'

export const DEFAULT_LIVE_OBJECT_OPTIONS = {}
export const DEFAULT_PROPERTY_OPTIONS = {}
export const DEFAULT_EVENT_HANDLER_OPTIONS = {}

export function Spec(options: LiveObjectOptions): ClassDecorator {
    const manifest = readManifest()
    return function (constructor: Function) {
        options = { ...DEFAULT_LIVE_OBJECT_OPTIONS, ...(options || {}) }
        constructor.prototype.options = options
        constructor.prototype.namespace = manifest.namespace
        constructor.prototype.name = manifest.name
        constructor.prototype.version = manifest.version
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

export function OnAll(): PropertyDecorator {
    return function (object: any, methodName: string | symbol) {
        object.constructor.prototype.beforeEventHandlers =
            object.constructor.prototype.beforeEventHandlers || []
        object.constructor.prototype.beforeEventHandlers.push(methodName)
    }
}

function readManifest(): StringKeyMap {
    let filePath = path.join(dir(getCallerFilePath()), 'manifest.json')
    filePath = filePath.startsWith('file:') ? filePath.slice(5) : filePath
    const manifest = JSON.parse(read(filePath))
    if (!manifest.namespace) throw 'No "namespace" in manifest'
    if (!manifest.name) throw 'No "name" in manifest'
    if (!manifest.version) throw 'No "version" in manifest'
    return manifest
}

function getCallerFilePath(): string {
    const originalFunc = Error.prepareStackTrace
    let callerfile
    try {
        let err = new Error()
        let currentfile
        Error.prepareStackTrace = function (_, stack) {
            return stack
        }
        let stack = err.stack as any
        currentfile = stack.shift().getFileName()

        while (stack.length) {
            callerfile = stack.shift().getFileName()
            if (currentfile !== callerfile) break
        }
    } catch (e) {
        console.error(`Failed to get caller file`, e)
    }
    Error.prepareStackTrace = originalFunc
    return callerfile
}
