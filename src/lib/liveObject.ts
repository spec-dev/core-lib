import {
    LiveObjectOptions,
    EventHandler,
    RegisteredEventHandler,
    RegisteredCallHandler,
    QuerySelectOptions,
    RegisteredProperty,
    Block,
    Transaction,
    Event,
    Call,
    StringKeyMap,
    PropertyMetadata,
    TableSpec,
    ColumnSpec,
    CallHandler,
} from './types'
import { contractEventNamespaceForChainId, schemaForChainId } from '@spec.types/spec'
import {
    toNamespacedVersion,
    fromNamespacedVersion,
    removeFirstDotSection,
    toArrayOfArrays,
} from './utils/formatters'
import PublishEventQueue from './publishEventQueue'
import Properties from './properties'
import { upsert, select } from './tables'
import humps from './utils/humps'

class LiveObject {
    declare _liveObjectNsp: string

    declare _liveObjectName: string

    declare _liveObjectVersion: string

    declare _options: LiveObjectOptions

    declare _table: string

    declare _propertyMetadata: { [key: string]: PropertyMetadata }

    declare _propertyRegistry: { [key: string]: RegisteredProperty }

    declare _eventHandlers: { [key: string]: RegisteredEventHandler }

    declare _callHandlers: { [key: string]: RegisteredCallHandler }

    declare _beforeEventHandlers: string[]

    declare _beforeCallHandlers: string[]

    declare currentBlock: Block

    declare currentTransaction: Transaction

    declare currentOrigin: StringKeyMap

    _publishEventQueue: PublishEventQueue

    _properties: Properties

    _tablesApiToken: string | null = null

    get _eventName(): string {
        return toNamespacedVersion(
            this._liveObjectNsp,
            `${this._liveObjectName}Upserted`,
            this._liveObjectVersion
        )
    }

    get _publishedEvents(): StringKeyMap[] {
        return this._publishEventQueue.items()
    }

    constructor(publishEventQueue: PublishEventQueue) {
        this._publishEventQueue = publishEventQueue

        for (const key in this._propertyMetadata || {}) {
            const metadata = this._propertyMetadata[key] || {}
            if (this._propertyRegistry.hasOwnProperty(key)) {
                this._propertyRegistry[key].metadata = metadata
            }
        }

        let uniqueBy = Array.isArray(this._options.uniqueBy)
            ? this._options.uniqueBy
            : [this._options.uniqueBy]

        if (Array.isArray(uniqueBy[0])) {
            uniqueBy = uniqueBy[0]
        }

        this._properties = new Properties(this._propertyRegistry, uniqueBy as string[])
    }

    async handleEvent(event: Event): Promise<boolean> {
        this.currentOrigin = event.origin

        // Get event handler method by name.
        const handler = this._getEventHandlerForEventName(event)
        if (!handler) throw `No event handler registered for event ${event.name}`

        // Ensure it actually exists on this.
        const method = ((this as StringKeyMap)[handler.methodName] as EventHandler).bind(this)
        if (!method) throw `Live object event handler is not callable: this[${handler.methodName}]`

        // Don't replay events restricted from doing so.
        const eventIsReplay = (event.origin as StringKeyMap).replay
        if (eventIsReplay && handler.options?.canReplay === false) {
            return false
        }

        // Execute all "before-event" handlers and then call the actual handler itself.
        await this._performBeforeEventHandlers(event)
        await method(event)
        return true
    }

    async handleCall(call: Call): Promise<boolean> {
        this.currentOrigin = call.origin

        // Get call handler method by name.
        const handler = this._getCallHandlerForFunctionName(call)
        if (!handler) throw `No call handler registered for function ${call.name}`

        // Ensure it actually exists on this.
        const method = ((this as StringKeyMap)[handler.methodName] as CallHandler).bind(this)
        if (!method) throw `Live object call handler is not callable: this[${handler.methodName}]`

        // Don't replay events restricted from doing so.
        const callIsReplay = (call.origin as StringKeyMap).replay
        if (callIsReplay && handler.options?.canReplay === false) {
            return false
        }

        // Execute all "before-call" handlers and then call the actual handler itself.
        await this._performBeforeCallHandlers(call)
        await method(call)
        return true
    }

    new(liveObjectType, initialProperties: StringKeyMap = {}) {
        // Create new live object and pass event response queue for execution context.
        const newLiveObject = new liveObjectType(this._publishEventQueue)
        newLiveObject._tablesApiToken = this._tablesApiToken

        // Assign any initial properties given.
        for (const propertyName in initialProperties) {
            newLiveObject[propertyName] = initialProperties[propertyName]
        }
        return newLiveObject
    }

    async find(
        liveObjectType,
        where: StringKeyMap | StringKeyMap[] = [],
        options?: QuerySelectOptions
    ): Promise<any[]> {
        const table = liveObjectType.prototype?._table
        if (!table) throw `Type has no table to query`

        // Convert property names into column names within where conditions and options.
        const filters = (Array.isArray(where) ? where : [where]).map((filter) =>
            this._properties.toColumnKeys(filter)
        )
        if (options?.orderBy?.column) {
            const orderByColumns = Array.isArray(options.orderBy.column)
                ? options.orderBy.column
                : [options.orderBy.column]

            const orderByColumnNames = orderByColumns
                .map((c) => this._properties.toColumnName(c))
                .filter((v) => !!v) as string[]

            if (orderByColumnNames.length) {
                options.orderBy.column = orderByColumnNames
            } else {
                delete options.orderBy
            }
        }

        // Find records.
        const records =
            (await select(table, filters, options, { token: this._tablesApiToken })) || []

        // Convert back into live object type / property types.
        return records.map((record) => {
            const liveObject = new liveObjectType(this._publishEventQueue)
            liveObject._tablesApiToken = this._tablesApiToken
            const propertyData = liveObject._properties.fromRecord(record)
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
        // Find this live object by its unique properties.
        const records =
            (await select(
                this._table,
                this._properties.getLoadFilters(this),
                { limit: 1 },
                { token: this._tablesApiToken }
            )) || []

        // Assign retrieved property values if record existed.
        const exists = records.length > 0
        exists && this.assignProperties(this._properties.fromRecord(records[0]))
        return exists
    }

    async save() {
        // Ensure properties have changed since last snapshot.
        if (!this._properties.haveChanged(this)) {
            console.warn('No properties have changed - not saving')
            return
        }

        // Get upsert components.
        const { insertData, conflictColumns, updateColumns } = this._properties.getUpsertComps(this)

        // Upsert live object.
        const payload = {
            table: this._table,
            data: insertData,
            conflictColumns,
            updateColumns,
            returning: '*',
        }
        const records = await upsert(payload, { token: this._tablesApiToken })

        // Map column names back to propertes and assign values.
        records.length && this.assignProperties(this._properties.fromRecord(records[0]))

        // Publish event stating that this live object was upserted.
        this.publishChange()
    }

    async query(
        table: string,
        where: StringKeyMap | StringKeyMap[] = [],
        options?: QuerySelectOptions
    ): Promise<any[]> {
        const filters = Array.isArray(where) ? where : [where]
        const records =
            (await select(table, filters, options, { token: this._tablesApiToken })) || []
        return humps.camelizeKeys(records)
    }

    async getCurrentBlock(): Promise<Block> {
        if (this.currentBlock) return this.currentBlock
        const { chainId, blockHash } = this.currentOrigin
        const tablePath = [schemaForChainId[chainId], 'blocks'].join('.')
        const records = await this.query(tablePath, { hash: blockHash }, { limit: 1 })
        this.currentBlock = records[0]
        return this.currentBlock
    }

    async getCurrentTransaction(): Promise<Transaction> {
        if (this.currentTransaction) return this.currentTransaction
        const { chainId, transactionHash } = this.currentOrigin
        const tablePath = [schemaForChainId[chainId], 'transactions'].join('.')
        const records = await this.query(tablePath, { hash: transactionHash }, { limit: 1 })
        this.currentTransaction = records[0]
        return this.currentTransaction
    }

    assignProperties(data: StringKeyMap) {
        if (!Object.keys(data).length) {
            console.warn(`Assigning empty properties`)
        }
        for (const propertyName in data) {
            this[propertyName] = data[propertyName]
        }
        this._properties.capture(this)
    }

    publishChange() {
        const data = this._properties.snapshot
        if (!data) throw `Can't publish a live object change that hasn't been persisted yet.`
        if (!Object.keys(data).length) {
            console.warn(`Publishing empty data`)
        }
        this.publishEvent(this._eventName, this._properties.serialize(data))
    }

    publishEvent(name: string, data: StringKeyMap) {
        this._publishEventQueue.push({ name, data })
    }

    tableSpec(): TableSpec {
        const indexByProperties = toArrayOfArrays(this._options.indexBy || [])
        const uniqueByProperties = toArrayOfArrays(this._options.uniqueBy || [])
        const [schema, table] = this._table.split('.')
        const columnsSchema = this._properties.toSchema()
        const columnNames = new Set(Object.keys(columnsSchema))

        const indexBy: string[][] = []
        for (const groupPropertyNames of indexByProperties) {
            const groupColumnNames: string[] = []
            for (const propertyName of groupPropertyNames) {
                const columnName = this._properties.toColumnName(propertyName)
                if (!columnName || !columnNames.has(columnName)) {
                    throw `"indexBy" references unknown property: "${propertyName}"`
                }
                groupColumnNames.push(columnName)
            }
            groupColumnNames.length && indexBy.push(groupColumnNames)
        }

        const uniqueBy: string[][] = []
        for (const groupPropertyNames of uniqueByProperties) {
            const groupColumnNames: string[] = []
            for (const propertyName of groupPropertyNames) {
                const columnName = this._properties.toColumnName(propertyName)
                if (!columnName || !columnNames.has(columnName)) {
                    throw `"uniqueBy" references unknown property: "${propertyName}"`
                }
                groupColumnNames.push(columnName)
            }
            groupColumnNames.length && uniqueBy.push(groupColumnNames)
        }

        const indexGroups = indexBy.map((group) => group.sort().join(':'))
        const columnSpecs: ColumnSpec[] = []
        for (const columnName in columnsSchema) {
            const info = columnsSchema[columnName]
            columnSpecs.push({
                name: columnName,
                type: info.type,
                default: info.default,
                notNull: info.notNull,
            })

            if (info.index && !indexGroups.includes(columnName)) {
                indexBy.push([columnName])
            }
        }

        return {
            schemaName: schema,
            tableName: table,
            columns: columnSpecs,
            uniqueBy,
            indexBy,
        }
    }

    _getEventHandlerForEventName(event: Event): RegisteredEventHandler | null {
        // Try matching against full event name first.
        let handler = this._eventHandlers[event.name]
        if (handler) return handler

        // Try removing version next.
        const { nsp, name } = fromNamespacedVersion(event.name)
        const eventNameWithoutVersion = [nsp, name].join('.')
        handler = this._eventHandlers[eventNameWithoutVersion]
        if (handler) return handler

        // It must be a contract event at this point.
        const contractEventNamespace = contractEventNamespaceForChainId(event.origin.chainId)
        const isContractEvent =
            contractEventNamespace && nsp.startsWith(`${contractEventNamespace}.`)
        if (!isContractEvent) return null

        // Check if chain prefix of contract event name is missing.
        handler =
            this._eventHandlers[removeFirstDotSection(event.name)] ||
            this._eventHandlers[removeFirstDotSection(eventNameWithoutVersion)]

        return handler || null
    }

    _getCallHandlerForFunctionName(call: Call): RegisteredCallHandler | null {
        const chainAgnosticFunctionName = call.name.split('.').slice(1).join('.')
        return (
            this._callHandlers[call.name] || this._callHandlers[chainAgnosticFunctionName] || null
        )
    }

    async _performBeforeEventHandlers(event: Event) {
        const methodNames = this._beforeEventHandlers || []
        for (const methodName of methodNames) {
            const beforeEventHandler = ((this as StringKeyMap)[methodName] as EventHandler).bind(
                this
            )
            if (!beforeEventHandler)
                throw `Live object before-event handler is not callable: this[${methodName}]`
            await beforeEventHandler(event)
        }
    }

    async _performBeforeCallHandlers(call: Call) {
        const methodNames = this._beforeCallHandlers || []
        for (const methodName of methodNames) {
            const beforeCallHandler = ((this as StringKeyMap)[methodName] as CallHandler).bind(this)
            if (!beforeCallHandler)
                throw `Live object before-call handler is not callable: this[${methodName}]`
            await beforeCallHandler(call)
        }
    }
}

export default LiveObject
