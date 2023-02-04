import {
    LiveObjectOptions,
    EventHandler,
    RegisteredEventHandler,
    QuerySelectOptions,
    RegisteredProperty,
} from './types'
import { SpecEvent, StringKeyMap, contractEventNamespaceForChainId } from '@spec.types/spec'
import { fromNamespacedVersion, removeFirstDotSection } from './utils/formatters'
import EventResponseQueue from './eventResponseQueue'
import Properties from './properties'
import { upsert, select } from './tables'

class LiveObject {
    declare name: string

    declare options: LiveObjectOptions

    declare table: string

    declare propertyRegistry: { [key: string]: RegisteredProperty }

    declare eventHandlers: { [key: string]: RegisteredEventHandler }

    declare beforeEventHandlers: string[]

    eventResponseQueue: EventResponseQueue

    properties: Properties

    constructor(eventResponseQueue: EventResponseQueue) {
        this.eventResponseQueue = eventResponseQueue
        this.properties = new Properties(this.propertyRegistry, this.options.uniqueBy)
    }

    async handleEvent(event: SpecEvent) {
        // Get event handler method by name.
        const handler = this._getHandlerForEventName(event)
        if (!handler) throw `No event handler registered for event ${event.name}`

        // Ensure it actually exists on this.
        const method = ((this as StringKeyMap)[handler.methodName] as EventHandler).bind(this)
        if (!method) throw `Live object event handler is not callable: this[${handler.methodName}]`

        // Execute all "before-event" handlers and then call the actual handler itself.
        await this._performBeforeEventHandlers(event)
        await method(event)
    }

    new(liveObjectType, initialProperties: StringKeyMap = {}) {
        // Create new live object and pass event response queue for execution context.
        const newLiveObject = new liveObjectType(this.eventResponseQueue)

        // Assign any initial properties give.
        for (const propertyName in initialProperties) {
            newLiveObject[propertyName] = initialProperties[propertyName]
        }
        return newLiveObject
    }

    async find(
        liveObjectType,
        where: StringKeyMap | StringKeyMap[],
        options?: QuerySelectOptions
    ): Promise<any[]> {
        const table = liveObjectType.prototype?.table
        if (!table) throw `Type has no table to query`

        // Convert property names into column names within where conditions and options.
        const filters = (Array.isArray(where) ? where : [where]).map((filter) =>
            this.properties.toColumnKeys(filter)
        )
        if (options?.orderBy?.column) {
            const orderByColumnName = this.properties.toColumnName(options.orderBy.column)
            if (orderByColumnName) {
                options.orderBy.column = orderByColumnName
            } else {
                delete options.orderBy
            }
        }

        // Find records.
        const records = (await select(table, filters, options)) || []

        // Convert back into live object type / property types.
        return records.map((record) => {
            const liveObject = new liveObjectType(this.eventResponseQueue)
            const propertyData = liveObject.properties.fromRecord(record)
            liveObject.assignProperties(propertyData)
            return liveObject
        })
    }

    async findOne(
        liveObjectType,
        where: StringKeyMap | StringKeyMap[],
        options?: QuerySelectOptions
    ) {
        options = { ...(options || {}), limit: 1 }
        const records = await this.find(liveObjectType, where, options)
        return records.length ? records[0] : null
    }

    async load(): Promise<boolean> {
        // Select by unique properties.
        const records =
            (await select(this.table, this.properties.getLoadFilters(this), { limit: 1 })) || []

        // Return no existence.
        if (!records.length) return false

        // Convert back into live object type / property types.
        const propertyData = this.properties.fromRecord(records[0])
        this.assignProperties(propertyData)

        return true
    }

    async save() {
        // Get upsert components.
        const { insertData, conflictColumns, updateColumns } = this.properties.getUpsertComps(this)

        // Upsert the live object.
        const records = await upsert(this.table, insertData, conflictColumns, updateColumns)

        console.log(records)

        // Either assign properties directly from response or load.
        // Will need to load during multi-statement transactions or
        records.length && this.assignProperties(this.properties.fromRecord(records[0]))

        // Figure out how to share emit event bullshit between models...
    }

    assignProperties(data: StringKeyMap) {
        for (const propertyName in data) {
            this[propertyName] = data[propertyName]
        }
    }

    _getHandlerForEventName(event: SpecEvent): RegisteredEventHandler | null {
        // Try matching against full event name first.
        let handler = this.eventHandlers[event.name]
        if (handler) return handler

        // Try removing version next.
        const { nsp, name } = fromNamespacedVersion(event.name)
        const eventNameWithoutVersion = [nsp, name].join('.')
        handler = this.eventHandlers[eventNameWithoutVersion]
        if (handler) return handler

        // It must be a contract event at this point.
        const contractEventNamespace = contractEventNamespaceForChainId(event.origin.chainId)
        const isContractEvent =
            contractEventNamespace && nsp.startsWith(`${contractEventNamespace}.`)
        if (!isContractEvent) return null

        // Check if chain prefix of contract event name is missing.
        handler =
            this.eventHandlers[removeFirstDotSection(event.name)] ||
            this.eventHandlers[removeFirstDotSection(eventNameWithoutVersion)]

        return handler || null
    }

    async _performBeforeEventHandlers(event: SpecEvent) {
        const methodNames = this.beforeEventHandlers || []
        for (const methodName of methodNames) {
            const beforeEventHandler = ((this as StringKeyMap)[methodName] as EventHandler).bind(
                this
            )
            if (!beforeEventHandler)
                throw `Live object before-event handler is not callable: this[${methodName}]`
            await beforeEventHandler(event)
        }
    }
}

export default LiveObject
