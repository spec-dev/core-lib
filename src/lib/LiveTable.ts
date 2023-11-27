import {
    LiveTableOptions,
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
    BlockHash,
    BlockNumber,
    Timestamp,
    ChainId,
    Abi,
} from './types'
import { Address, schemaForChainId } from '@spec.types/spec'
import { toNamespacedVersion, fromNamespacedVersion, toArrayOfArrays } from './utils/formatters'
import Queue from './Queue'
import Properties from './Properties'
import { upsert, select, prodSelect } from './tables'
import humps from './utils/humps'
import { camelToSnake, unique, getContractGroupFromInputName } from './utils/formatters'
import { blockSpecificProperties } from './utils/defaults'
import Contract from './contracts/Contract'
import { NUMBER, BIG_FLOAT, BIG_INT, BLOCK_NUMBER, TIMESTAMP, DATE } from './utils/propertyTypes'
import { BigInt, BigFloat } from './helpers'

class LiveTable {
    declare _liveObjectNsp: string

    declare _liveObjectName: string

    declare _liveObjectVersion: string

    declare _liveObjectDisplayName: string

    declare _liveObjectDescription: string

    declare _liveObjectChainIds: string[]

    declare _options: LiveTableOptions

    declare _table: string

    declare _setPropertyMetadataPromise: Promise<any>

    declare _propertyMetadataPromise: Promise<{ [key: string]: PropertyMetadata }>

    declare _absorbManifestPromise: Promise<any>

    declare _manifestPromise: Promise<Manifest>

    declare _propertyRegistry: { [key: string]: RegisteredProperty }

    declare _eventHandlers: { [key: string]: RegisteredEventHandler }

    declare _callHandlers: { [key: string]: RegisteredCallHandler }

    declare _beforeEventHandlers: string[]

    declare contract: any

    declare currentBlock: Block

    declare currentTransaction: Transaction

    declare currentOrigin: StringKeyMap

    declare blockHash: BlockHash

    declare blockNumber: BlockNumber

    declare blockTimestamp: Timestamp

    declare chainId: ChainId

    _inputContractGroupAbis: { [key: string]: Abi }

    _publishEventQueue: Queue

    _contractRegistrationQueue: Queue

    _properties: Properties

    _tablesApiToken: string | null = null

    get _publishedEvents(): StringKeyMap[] {
        return this._publishEventQueue.items()
    }

    get _newContractInstances(): StringKeyMap[] {
        return this._contractRegistrationQueue.items()
    }

    constructor(
        inputContractGroupAbis: { [key: string]: Abi },
        publishEventQueue: Queue,
        contractRegistrationQueue: Queue
    ) {
        this._inputContractGroupAbis = inputContractGroupAbis
        this._publishEventQueue = publishEventQueue
        this._contractRegistrationQueue = contractRegistrationQueue

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
                    if (!this._propertyRegistry.hasOwnProperty(key)) continue
                    this._propertyRegistry[key].metadata = metadata
                    const options = this._propertyRegistry[key].options || {}
                    if (metadata.type?.endsWith('[]') && !options.hasOwnProperty('default')) {
                        this._propertyRegistry[key].options.default = []
                    } else if (
                        [NUMBER, BIG_INT, BIG_FLOAT].includes(metadata.type) &&
                        !options.hasOwnProperty('default')
                    ) {
                        this._propertyRegistry[key].options.default = 0
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
                // Assign values for properties with defaults.
                let defaultSet = false
                for (const propertyName in this._propertyRegistry) {
                    const { options } = this._propertyRegistry[propertyName]
                    if (!options.hasOwnProperty('default')) continue
                    if (this[propertyName] !== undefined) continue

                    defaultSet = true
                    const propertyType = propertyMetadata[propertyName].type
                    switch (propertyType) {
                        case BIG_INT:
                        case BLOCK_NUMBER:
                            this[propertyName] = BigInt.from(options.default)
                            break
                        case BIG_FLOAT:
                            this[propertyName] = BigFloat.from(options.default)
                            break
                        case DATE:
                        case TIMESTAMP:
                            this[propertyName] = new Date(options.default)
                            break
                        default:
                            this[propertyName] = options.default
                            break
                    }
                }

                this._properties.registry = this._propertyRegistry
                defaultSet && this._properties.capture(this)
            }
        )

        this._absorbManifestPromise = this._manifestPromise.then((manifest) => {
            this._liveObjectNsp = manifest.namespace
            this._liveObjectName = manifest.name
            this._liveObjectVersion = manifest.version
            this._liveObjectDisplayName = manifest.displayName
            this._liveObjectDescription = manifest.description
            this._liveObjectChainIds = unique((manifest.chains || []).map((id) => id.toString()))
            this._table =
                this._options.table ||
                [
                    manifest.namespace,
                    [camelToSnake(manifest.name), manifest.version.replace(/\W/g, '')].join('_'),
                ].join('.')
        })

        this._fsPromises()
    }

    async handleEvent(event: Event): Promise<boolean> {
        await this._fsPromises()
        this.currentOrigin = event.origin
        this.currentTransaction = this.currentOrigin.transaction || {}

        // Get event handler method by name.
        const handler = this._getEventHandlerForEventName(event)
        if (!handler) throw `No event handler registered for event ${event.name}`
        const handlerOptions = handler.options || {}

        // Ensure it actually exists on this.
        const method = ((this as StringKeyMap)[handler.methodName] as EventHandler).bind(this)
        if (!method) throw `Live object event handler is not callable: this[${handler.methodName}]`

        // Create a new Contract instance pointing to this event's origin contract.
        this._assignInputContract(event)

        // Execute all "before-event" handlers and then call the actual handler itself.
        this._assignBlockSpecificPropertiesFromOrigin()
        if (!(await this._performBeforeEventHandlers(event))) return false
        const resp = await method(event)

        // Return whether to auto-save or not.
        return handlerOptions.autoSave === false || resp === false ? false : true
    }

    async handleCall(call: Call): Promise<boolean> {
        await this._fsPromises()
        this.currentOrigin = call.origin
        this.currentTransaction = this.currentOrigin.transaction || {}

        // Get call handler method by name.
        const handler = this._getCallHandlerForFunctionName(call)
        if (!handler) throw `No call handler registered for function ${call.name}`
        const handlerOptions = handler.options || {}

        // Ensure it actually exists on this.
        const method = ((this as StringKeyMap)[handler.methodName] as CallHandler).bind(this)
        if (!method) throw `Live object call handler is not callable: this[${handler.methodName}]`

        // Create a new Contract instance pointing to this method's origin contract.
        this._assignInputContract(call)

        // Handle the contract call.
        this._assignBlockSpecificPropertiesFromOrigin()
        const resp = await method(call)

        // Return whether to auto-save or not.
        return handlerOptions.autoSave === false || resp === false ? false : true
    }

    new(liveTableType, initialProperties: StringKeyMap = {}) {
        // Create new live object and pass event response queue for execution context.
        const newLiveObject = new liveTableType(
            {},
            this._publishEventQueue,
            this._contractRegistrationQueue
        )
        newLiveObject._tablesApiToken = this._tablesApiToken
        newLiveObject.currentBlock = this.currentBlock
        newLiveObject.currentTransaction = this.currentTransaction
        newLiveObject.currentOrigin = this.currentOrigin
        newLiveObject.contract = this.contract

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
        liveTableType,
        where: StringKeyMap | StringKeyMap[] = [],
        options?: QuerySelectOptions
    ): Promise<any[]> {
        const referenceObject = new liveTableType()
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
                const liveObject = new liveTableType(
                    {},
                    this._publishEventQueue,
                    this._contractRegistrationQueue
                )
                await liveObject._fsPromises()
                liveObject._tablesApiToken = this._tablesApiToken
                liveObject.currentBlock = this.currentBlock
                liveObject.currentTransaction = this.currentTransaction
                liveObject.currentOrigin = this.currentOrigin
                liveObject.contract = this.contract

                const propertyData = liveObject._properties.fromRecord(record)
                liveObject._assignProperties(propertyData)

                if (
                    !liveObject.chainId ||
                    liveObject.chainId === liveObject.currentOrigin.chainId
                ) {
                    liveObject._assignBlockSpecificPropertiesFromOrigin()
                }

                return liveObject
            })
        )
    }

    async findOne(
        liveTableType,
        where: StringKeyMap | StringKeyMap[],
        options?: QuerySelectOptions
    ) {
        options = { ...(options || {}), limit: 1 }
        const records = await this.find(liveTableType, where, options)
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
        if (exists) {
            this._assignProperties(this._properties.fromRecord(records[0]))
            if (!this.chainId || this.chainId === this.currentOrigin.chainId) {
                this._assignBlockSpecificPropertiesFromOrigin()
            }
        }

        return exists
    }

    async save() {
        await this._fsPromises()

        // Get upsert components.
        const upsertComps = this._properties.getUpsertComps(this)
        if (!upsertComps) return
        const { insertData, conflictColumns, updateColumns, primaryTimestampColumn } = upsertComps

        // Upsert live object.
        const payload = {
            table: this._table,
            data: insertData,
            conflictColumns,
            updateColumns,
            primaryTimestampColumn,
            returning: '*',
        }
        const records = await upsert(payload, { token: this._tablesApiToken })
        if (!records.length || !records[0]) return

        // Map column names back to propertes and assign values.
        this._assignProperties(this._properties.fromRecord(records[0]))

        // Publish event stating that this live object was upserted.
        await this._publishChange()
    }

    async query(
        table: string,
        where: StringKeyMap | StringKeyMap[] = [],
        options: QuerySelectOptions = {},
        prod: boolean = true
    ): Promise<any[]> {
        const filters = Array.isArray(where) ? where : [where]
        const method = prod ? prodSelect : select
        const records =
            (await method(table, filters, options, { token: this._tablesApiToken })) || []
        return humps.camelizeKeys(records)
    }

    async getCurrentBlock(): Promise<Block> {
        if (this.currentBlock) return this.currentBlock
        const { chainId, blockHash } = this.currentOrigin
        const tablePath = [schemaForChainId(chainId), 'blocks'].join('.')
        const records = await this.query(tablePath, { hash: blockHash }, { limit: 1 })
        this.currentBlock = records[0]
        return this.currentBlock
    }

    async getCurrentTransaction(): Promise<Transaction> {
        if (this.currentTransaction) return this.currentTransaction
        const { chainId, transactionHash } = this.currentOrigin
        const tablePath = [schemaForChainId(chainId), 'transactions'].join('.')
        const records = await this.query(tablePath, { hash: transactionHash }, { limit: 1 })
        this.currentTransaction = records[0]
        return this.currentTransaction
    }

    addContractToGroup(address: string, group: string) {
        this._contractRegistrationQueue.push({ address, chainId: this.chainId, group })
    }

    getAbi(contractGroup: string): Abi | null {
        return this._inputContractGroupAbis[contractGroup] || null
    }

    bind(
        contractAddress: Address,
        contractGroup?: string,
        chainId?: ChainId,
        withRpcResponseSyntax: boolean = true
    ): any {
        const abi = contractGroup ? this.getAbi(contractGroup) : this.contract?._abi
        chainId = chainId || this.chainId
        if (!abi) throw `No ABI for contract group: ${contractGroup}`
        return new Contract(chainId, contractAddress, abi, withRpcResponseSyntax) as any
    }

    async getEventName(): Promise<string> {
        await this._fsPromises()
        return toNamespacedVersion(
            this._liveObjectNsp,
            `${this._liveObjectName}Changed`,
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

    async liveObjectSpec(): Promise<StringKeyMap> {
        await this._fsPromises()

        const chains = this._liveObjectChainIds || []
        const chainsConfig = {}
        chains.forEach((id) => {
            chainsConfig[id] = {} // future
        })

        let primaryTimestampProperty: string | null = null
        const properties: StringKeyMap = []
        for (const { name, options, metadata } of Object.values(this._properties.registry)) {
            properties.push({ name, type: metadata?.type, desc: '...' })
            if (options.primaryTimestamp) {
                primaryTimestampProperty = name
            }
        }

        return {
            namespace: this._liveObjectNsp,
            name: this._liveObjectName,
            version: this._liveObjectVersion,
            displayName: this._liveObjectDisplayName,
            description: this._liveObjectDescription,
            chains,
            properties,
            config: {
                primaryTimestampProperty,
                uniqueBy: toArrayOfArrays(this._properties.uniqueBy),
                table: this._table,
                chains: chainsConfig,
            },
            inputEvents: Object.keys(this._eventHandlers || {}),
            inputCalls: Object.keys(this._callHandlers || {}),
        }
    }

    _assignProperties(data: StringKeyMap) {
        if (!Object.keys(data).length) {
            console.warn(`Assigning empty properties`)
        }
        for (const propertyName in data) {
            this[propertyName] = data[propertyName]
        }
        this._properties.capture(this)
    }

    async _publishChange() {
        await this._fsPromises()
        const data = this._properties.snapshot
        if (!data) throw `Can't publish a live object change that hasn't been persisted yet.`
        if (!Object.keys(data).length) {
            const eventName = await this.getEventName()
            console.warn(`No changes to publish for ${eventName}`)
            return
        }
        this._publishEvent(await this.getEventName(), this._properties.serialize(data))
    }

    _publishEvent(name: string, data: StringKeyMap) {
        this._publishEventQueue.push({ name, data })
    }

    _assignBlockSpecificPropertiesFromOrigin() {
        this._propertyRegistry = this._propertyRegistry || {}

        for (const propertyName in blockSpecificProperties) {
            if (
                this._propertyRegistry.hasOwnProperty(propertyName) &&
                this.currentOrigin?.hasOwnProperty(propertyName)
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
        const { nsp, name } = fromNamespacedVersion(event.name)
        const eventNameWithoutVersion = [nsp, name].join('.')
        const prioritizedMatchOptions = [
            event.name, // with version
            eventNameWithoutVersion,
        ]

        for (const option of prioritizedMatchOptions) {
            const handler = this._eventHandlers[option]
            if (handler) return handler
        }

        return null
    }

    _getCallHandlerForFunctionName(call: Call): RegisteredCallHandler | null {
        const { nsp, name, version } = fromNamespacedVersion(call.name)
        const functionNameWithoutVersion = [nsp, name].join('.')
        const prioritizedMatchOptions = [call.name, functionNameWithoutVersion]

        for (const option of prioritizedMatchOptions) {
            const handler = this._callHandlers[option]
            if (handler) return handler
        }

        return null
    }

    async _performBeforeEventHandlers(event: Event): Promise<boolean> {
        const methodNames = this._beforeEventHandlers || []
        for (const methodName of methodNames) {
            const beforeEventHandler = ((this as StringKeyMap)[methodName] as EventHandler).bind(
                this
            )
            if (!beforeEventHandler)
                throw `Live object before-event handler is not callable: this[${methodName}]`
            const resp = await beforeEventHandler(event)
            if (resp === false) return false
        }
        return true
    }

    _assignInputContract(input: StringKeyMap) {
        const contractGroup = getContractGroupFromInputName(input.name)
        if (!contractGroup) throw `Not able to infer contract group from input: ${input.name}`
        const inputContractAbi = this._inputContractGroupAbis[contractGroup]
        if (!inputContractAbi) throw `No ABI for contract group: ${contractGroup}`
        this.contract = new Contract(
            this.currentOrigin.chainId,
            this.currentOrigin.contractAddress,
            inputContractAbi
        )
    }

    async _fsPromises() {
        await Promise.all([this._absorbManifestPromise, this._setPropertyMetadataPromise])
    }
}

export default LiveTable
