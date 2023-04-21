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
    Manifest,
} from './types'
import { schemaForChainId } from '@spec.types/spec'
import { toNamespacedVersion, fromNamespacedVersion, toArrayOfArrays } from './utils/formatters'
import PublishEventQueue from './publishEventQueue'
import Properties from './properties'
import { upsert, select } from './tables'
import humps from './utils/humps'
import { camelToSnake } from './utils/formatters'
import { blockSpecificProperties } from './utils/defaults'

class LiveObject {
    declare _liveObjectNsp: string

    declare _liveObjectName: string

    declare _liveObjectVersion: string

    declare _options: LiveObjectOptions

    declare _table: string

    declare _setPropertyMetadataPromise: Promise<any>

    declare _propertyMetadataPromise: Promise<{ [key: string]: PropertyMetadata }>

    declare _absorbManifestPromise: Promise<any>

    declare _manifestPromise: Promise<Manifest>

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

    get _publishedEvents(): StringKeyMap[] {
        return this._publishEventQueue.items()
    }

    constructor(publishEventQueue: PublishEventQueue) {
        this._publishEventQueue = publishEventQueue

        let uniqueBy = Array.isArray(this._options.uniqueBy)
            ? this._options.uniqueBy
            : [this._options.uniqueBy]

        if (Array.isArray(uniqueBy[0])) {
            uniqueBy = uniqueBy[0]
        }

        this._addBlockSpecificPropertiesToRegistry()

        this._properties = new Properties(this._propertyRegistry, uniqueBy as string[])

        this._setPropertyMetadataPromise = this._propertyMetadataPromise.then(
            (propertyMetadata) => {
                // Set standard property metadata.
                for (const key in propertyMetadata || {}) {
                    const metadata = propertyMetadata[key] || {}
                    if (this._propertyRegistry.hasOwnProperty(key)) {
                        this._propertyRegistry[key].metadata = metadata
                    }
                }
                // Add metadata for default block-specific properties.
                for (const propertyName in blockSpecificProperties) {
                    const { type } = blockSpecificProperties[propertyName]
                    if (
                        this._propertyRegistry.hasOwnProperty(propertyName) &&
                        !this._propertyRegistry[propertyName].metadata
                    ) {
                        this._propertyRegistry[propertyName].metadata = { type }
                    }
                }
                this._properties.registry = this._propertyRegistry
            }
        )

        this._absorbManifestPromise = this._manifestPromise.then((manifest) => {
            this._liveObjectNsp = manifest.namespace
            this._liveObjectName = manifest.name
            this._liveObjectVersion = manifest.version
            this._table =
                this._options.table || [manifest.namespace, camelToSnake(manifest.name)].join('.')
        })

        this._fsPromises()
    }

    async handleEvent(event: Event): Promise<boolean> {
        this.currentOrigin = event.origin

        // Get event handler method by name.
        const handler = this._getEventHandlerForEventName(event)
        if (!handler) throw `No event handler registered for event ${event.name}`
        const handlerOptions = handler.options || {}

        // Ensure it actually exists on this.
        const method = ((this as StringKeyMap)[handler.methodName] as EventHandler).bind(this)
        if (!method) throw `Live object event handler is not callable: this[${handler.methodName}]`

        // Don't replay events restricted from doing so.
        const eventIsReplay = (event.origin as StringKeyMap).replay
        if (eventIsReplay && handlerOptions.canReplay === false) {
            return false
        }

        // Execute all "before-event" handlers and then call the actual handler itself.
        this._assignBlockSpecificPropertiesFromOrigin()
        await this._performBeforeEventHandlers(event)
        await method(event)

        // Return whether to auto-save or not.
        return handlerOptions.autoSave === false ? false : true
    }

    async handleCall(call: Call): Promise<boolean> {
        this.currentOrigin = call.origin

        // Get call handler method by name.
        const handler = this._getCallHandlerForFunctionName(call)
        if (!handler) throw `No call handler registered for function ${call.name}`
        const handlerOptions = handler.options || {}

        // Ensure it actually exists on this.
        const method = ((this as StringKeyMap)[handler.methodName] as CallHandler).bind(this)
        if (!method) throw `Live object call handler is not callable: this[${handler.methodName}]`

        // Don't replay events restricted from doing so.
        const callIsReplay = (call.origin as StringKeyMap).replay
        if (callIsReplay && handlerOptions.canReplay === false) {
            return false
        }

        // Execute all "before-call" handlers and then call the actual handler itself.
        this._assignBlockSpecificPropertiesFromOrigin()
        await this._performBeforeCallHandlers(call)
        await method(call)

        // Return whether to auto-save or not.
        return handlerOptions.autoSave === false ? false : true
    }

    new(liveObjectType, initialProperties: StringKeyMap = {}) {
        // Create new live object and pass event response queue for execution context.
        const newLiveObject = new liveObjectType(this._publishEventQueue)
        newLiveObject._tablesApiToken = this._tablesApiToken

        // Pass any block-specific properties over unless included in properties given.
        for (const propertyName in blockSpecificProperties) {
            if (
                newLiveObject._propertyRegistry.hasOwnProperty(propertyName) &&
                !initialProperties.hasOwnProperty(propertyName)
            ) {
                newLiveObject[propertyName] = this[propertyName]
            }
        }

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
        const referenceObject = new liveObjectType()
        await referenceObject._fsPromises()
        const table = referenceObject._table
        if (!table) throw `Type has no table to query`

        // Convert property names into column names within where conditions and options.
        const filters = (Array.isArray(where) ? where : [where]).map((filter) =>
            referenceObject._properties.toColumnKeys(filter)
        )
        if (options?.orderBy?.column) {
            const orderByColumns = Array.isArray(options.orderBy.column)
                ? options.orderBy.column
                : [options.orderBy.column]

            const orderByColumnNames = orderByColumns
                .map((c) => referenceObject._properties.toColumnName(c))
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
        return await Promise.all(
            records.map(async (record) => {
                const liveObject = new liveObjectType(this._publishEventQueue)
                await liveObject._fsPromises()
                liveObject._tablesApiToken = this._tablesApiToken
                const propertyData = liveObject._properties.fromRecord(record)
                liveObject.assignProperties(propertyData)
                return liveObject
            })
        )
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
        await this._fsPromises()
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
        await this._fsPromises()
        // Ensure properties have changed since last snapshot.
        if (!this._properties.haveChanged(this)) return

        // Get upsert components.
        const upsertComps = this._properties.getUpsertComps(this)
        if (!upsertComps) return null
        const { insertData, conflictColumns, updateColumns } = upsertComps

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
        await this.publishChange()
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

    async publishChange() {
        await this._fsPromises()
        const data = this._properties.snapshot
        if (!data) throw `Can't publish a live object change that hasn't been persisted yet.`
        if (!Object.keys(data).length) {
            console.warn(`Publishing empty data`)
        }
        this.publishEvent(await this.getEventName(), this._properties.serialize(data))
    }

    publishEvent(name: string, data: StringKeyMap) {
        this._publishEventQueue.push({ name, data })
    }

    async getEventName(): Promise<string> {
        await this._fsPromises()
        return toNamespacedVersion(
            this._liveObjectNsp,
            `${this._liveObjectName}Upserted`,
            this._liveObjectVersion
        )
    }

    async tableSpec(): Promise<TableSpec> {
        await this._fsPromises()
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

    _assignBlockSpecificPropertiesFromOrigin() {
        this._propertyRegistry = this._propertyRegistry || {}

        for (const propertyName in blockSpecificProperties) {
            if (
                this._propertyRegistry.hasOwnProperty(propertyName) &&
                this.currentOrigin.hasOwnProperty(propertyName)
            ) {
                this[propertyName] = this.currentOrigin[propertyName]
            }
        }
    }

    _addBlockSpecificPropertiesToRegistry() {
        this._propertyRegistry = this._propertyRegistry || {}

        for (const propertyName in blockSpecificProperties) {
            const { name, options } = blockSpecificProperties[propertyName]
            this._propertyRegistry[name] = this._propertyRegistry[name] || {
                name,
                options: options || {},
            }
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

        // ... Must be a contract event at this point ...

        const splitProperEventName = eventNameWithoutVersion.split('.')
        const chainNsp = splitProperEventName[0]

        // "contracts.nsp.contract.event"
        const chainAgnosticEventNameWithContractsNsp = splitProperEventName.slice(1).join('.')

        // "nsp.contract.event"
        const chainAgnosticEventName = splitProperEventName.slice(2).join('.')

        // "eth.nsp.contract.event"
        const missingContractsNspEventName = [chainNsp, chainAgnosticEventName].join('.')

        return (
            this._eventHandlers[chainAgnosticEventNameWithContractsNsp] ||
            this._eventHandlers[chainAgnosticEventName] ||
            this._eventHandlers[missingContractsNspEventName] ||
            null
        )
    }

    _getCallHandlerForFunctionName(call: Call): RegisteredCallHandler | null {
        // "eth.contracts.nsp.contract.func"
        const properFunctionName = call.name
        const splitProperFunctionName = properFunctionName.split('.')
        const chainNsp = splitProperFunctionName[0]

        // "contracts.nsp.contract.func"
        const chainAgnosticFunctionNameWithContractsNsp = splitProperFunctionName.slice(1).join('.')

        // "nsp.contract.func"
        const chainAgnosticFunctionName = splitProperFunctionName.slice(2).join('.')

        // "eth.nsp.contract.func"
        const missingContractsNspFunctionName = [chainNsp, chainAgnosticFunctionName].join('.')

        return (
            this._callHandlers[properFunctionName] ||
            this._callHandlers[chainAgnosticFunctionNameWithContractsNsp] ||
            this._callHandlers[chainAgnosticFunctionName] ||
            this._callHandlers[missingContractsNspFunctionName] ||
            null
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

    async _fsPromises() {
        await Promise.all([this._absorbManifestPromise, this._setPropertyMetadataPromise])
    }
}

export default LiveObject
