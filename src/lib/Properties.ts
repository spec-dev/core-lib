import LiveTable from './LiveTable'
import {
    PropertyMetadata,
    PropertyOptions,
    RegisteredProperty,
    StringKeyMap,
    StringMap,
} from './types'
import {
    attemptToParseDate,
    attemptToParseNumber,
    camelToSnake,
    stringify,
} from './utils/formatters'
import { UpsertComps } from './types'
import {
    BOOLEAN,
    isDate,
    NUMBER,
    DATE,
    BIG_INT,
    BIG_FLOAT,
    BLOCK_NUMBER,
    guessColType,
} from './utils/propertyTypes'
import { JSON as JsonColType } from './utils/columnTypes'
import { BigFloat, BigInt } from './helpers'
import { sha256 } from 'js-sha256'
import { blockSpecificProperties } from './utils/defaults'

class Properties {
    registry: { [key: string]: RegisteredProperty }

    protected columnToPropertyName: StringMap = {}

    protected propertyToColumnName: StringMap = {}

    uniqueBy: string[]

    snapshot: StringKeyMap = {}

    get uniqueByColumnNames(): string[] {
        return this.uniqueBy.map((propertyName) => this.toColumnName(propertyName) as string)
    }

    get primaryTimestampPropertyName(): string | null {
        return (
            Object.values(this.registry).find(({ options }) => !!options.primaryTimestamp)?.name ||
            null
        )
    }

    constructor(registry: { [key: string]: RegisteredProperty }, uniqueBy: string[]) {
        this.registry = registry
        this._buildPropertyColumnNameMappings()

        this.uniqueBy = uniqueBy
        if (!this.uniqueBy.length) {
            throw 'Live object has no "uniqueBy" properties.'
        }

        const unregisteredUniqueByProperties = this.uniqueBy.filter(
            (p) => !this.registry.hasOwnProperty(p)
        )
        if (unregisteredUniqueByProperties.length) {
            throw `Live object has "uniqueBy" properties that are not tagged as @Property: ${unregisteredUniqueByProperties.join(
                ', '
            )}`
        }
    }

    getLoadFilters(liveObject: LiveTable): StringKeyMap {
        const filters = {}
        for (const propertyName of this.uniqueBy) {
            const value = liveObject[propertyName]
            if (value === undefined) {
                throw `Live object is missing required unique property "${propertyName}" in order to load.`
            }
            filters[this.toColumnName(propertyName) as string] = this.toColumnType(
                value,
                this.registry[propertyName].metadata?.type || null
            )
        }
        return filters
    }

    getUpsertComps(liveObject: LiveTable): UpsertComps | null {
        const propertyData = this.diffSinceLastSnapshot(liveObject)

        // Ensure all unique constraint properties have values.
        for (const propertyName of this.uniqueBy) {
            if (!propertyData.hasOwnProperty(propertyName)) {
                return null
            }
        }

        // Ensure the primary timestamp property exists.
        if (!this.primaryTimestampPropertyName) {
            throw `No primary timestamp property found.`
        }

        // Ensure the primary timestamp property holds value.
        const primaryTimestampProperty = this.primaryTimestampPropertyName!
        if (!propertyData[primaryTimestampProperty]) {
            throw `Primary timestamp property "${primaryTimestampProperty}" not set`
        }

        // Get the list of the property names to update on conflict.
        const updatePropertyNames: string[] = []
        for (const propertyName in propertyData) {
            const shouldUpdate = !this.isUnique(propertyName) && this.canUpdate(propertyName)
            shouldUpdate && updatePropertyNames.push(propertyName)
        }

        // Build "INSERT (...) ON CONFLICT (...) DO UPDATE SET (...)" components.
        return {
            insertData: this.toRecord(propertyData),
            conflictColumns: this.uniqueByColumnNames,
            updateColumns: updatePropertyNames.map((p) => this.toColumnName(p)!),
            primaryTimestampColumn: this.toColumnName(primaryTimestampProperty)!,
        }
    }

    capture(liveObject: LiveTable) {
        const snapshot = {}
        for (const propertyName in this.registry) {
            let currentValue = liveObject[propertyName]

            if (typeof currentValue === 'object' && currentValue !== null) {
                if (Array.isArray(currentValue)) {
                    currentValue = [...currentValue]
                } else if (!currentValue._isBigNumber) {
                    try {
                        currentValue = { ...currentValue }
                    } catch (e) {
                        currentValue = liveObject[propertyName]
                    }
                }
            }

            snapshot[propertyName] = currentValue
        }
        this.snapshot = snapshot
    }

    diffSinceLastSnapshot(liveObject: LiveTable): StringKeyMap {
        const diff = {}
        for (const propertyName in this.registry) {
            const currentValue = liveObject[propertyName]
            if (currentValue === undefined) continue

            const snapshotValue = this.snapshot[propertyName]

            if (
                this.isUnique(propertyName) ||
                blockSpecificProperties.hasOwnProperty(propertyName) ||
                this.didPropertyChange(propertyName, currentValue, snapshotValue)
            ) {
                diff[propertyName] = currentValue
            }
        }
        return diff
    }

    didPropertyChange(name: string, a: any, b: any): boolean {
        const type = this.registry[name].metadata?.type || null
        const aColValue = this.toColumnType(a, type)
        const bColValue = this.toColumnType(b, type)
        return this._propertyAsHash(aColValue) !== this._propertyAsHash(bColValue)
    }

    _propertyAsHash(value: any): string | null {
        if (value === null || value === undefined) return null
        let hash
        try {
            hash = sha256(typeof value === 'string' ? value : JSON.stringify(value))
        } catch (err) {
            try {
                hash = sha256(value)
            } catch (e) {
                return value
            }
        }
        return hash
    }

    withValues(liveObject: LiveTable): StringKeyMap {
        const withValues = {}
        for (const propertyName in this.registry) {
            const value = liveObject[propertyName]
            if (value === undefined) continue
            withValues[propertyName] = value
        }
        return withValues
    }

    serialize(propertyData: StringKeyMap): StringKeyMap {
        const serialized = {}
        for (const propertyName in propertyData) {
            serialized[propertyName] = this.toColumnType(
                propertyData[propertyName],
                this.registry[propertyName].metadata?.type || null
            )
        }
        return serialized
    }

    toRecord(propertyData: StringKeyMap): StringKeyMap {
        const columnData = {}
        for (const propertyName in propertyData) {
            const columnName = this.toColumnName(propertyName)
            if (!columnName) continue
            columnData[columnName] = this.toColumnType(
                propertyData[propertyName],
                this.registry[propertyName].metadata?.type || null
            )
        }
        return columnData
    }

    fromRecord(record: StringKeyMap): StringKeyMap {
        const propertyData = {}
        for (const columnName in record) {
            const propertyName = this.fromColumnName(columnName)
            if (!propertyName) continue
            propertyData[propertyName] = this.fromColumnType(
                record[columnName],
                this.registry[propertyName].metadata?.type || null
            )
        }
        return propertyData
    }

    toColumnName(name: string): string | null {
        return this.propertyToColumnName[name] || null
    }

    fromColumnName(name: string): string | null {
        return this.columnToPropertyName[name] || null
    }

    toColumnType(value: any, type: string | null) {
        const lowerType = type?.toLowerCase()
        if (value === null || value === undefined) return null
        if (isDate(value)) return value.toISOString()
        if (lowerType === NUMBER) return attemptToParseNumber(value)
        if (lowerType === BOOLEAN) return Boolean(value)
        // @ts-ignore
        if ([BIG_INT, BIG_FLOAT, BLOCK_NUMBER].includes(type)) return value.toString()
        if (lowerType === 'json' || typeof value === 'object') return stringify(value)
        return value
    }

    fromColumnType(value: any, type: string | null) {
        const lowerType = type?.toLowerCase()
        if (value === null) return null
        if (lowerType === DATE) return attemptToParseDate(value)
        if (lowerType === NUMBER) return attemptToParseNumber(value)
        if (lowerType === BOOLEAN) return Boolean(value)
        if (type === BIG_INT || type === BLOCK_NUMBER) return BigInt.from(value)
        if (type === BIG_FLOAT) return BigFloat.from(value)
        return value
    }

    toColumnKeys(data: StringKeyMap): StringKeyMap {
        const columnData = {}
        for (const propertyName in data) {
            const columnName = this.toColumnName(propertyName)
            if (!columnName) continue
            columnData[columnName] = data[propertyName]
        }
        return columnData
    }

    toSchema(): StringKeyMap {
        const schema = {}
        for (const propertyName in this.registry) {
            const columnName = this.toColumnName(propertyName) as string
            const info = this.registry[propertyName] || {}
            const metadata = info.metadata || ({} as PropertyMetadata)
            const options = info.options || ({} as PropertyOptions)
            const columnType = options.columnType || guessColType(metadata.type)

            let defaultValue: any = null
            if (options.hasOwnProperty('default')) {
                if (columnType === JsonColType && typeof options.default === 'object') {
                    defaultValue = JSON.stringify(options.default)
                } else {
                    defaultValue = options.default?.toString() || null
                }
            }

            schema[columnName] = {
                type: columnType,
                index: options.index,
                default: defaultValue,
                notNull: options.notNull || false,
            }
        }
        return schema
    }

    isUnique(name: string): boolean {
        return this.uniqueBy.includes(name)
    }

    canUpdate(name: string): boolean {
        const options = this.options(name)
        if (!options) return false
        return options.canUpdate !== false
    }

    options(name: string): PropertyOptions | null {
        const property = this.registry[name]
        if (!property) return null
        return property.options
    }

    metadata(name: string): any {
        const property = this.registry[name]
        if (!property) return null
        return property.metadata
    }

    _buildPropertyColumnNameMappings() {
        for (const propertyName in this.registry) {
            const columnName =
                this.registry[propertyName].options.columnName || camelToSnake(propertyName)
            this.propertyToColumnName[propertyName] = columnName
            this.columnToPropertyName[columnName] = propertyName
        }
    }
}

export default Properties
