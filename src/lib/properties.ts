import LiveObject from './liveObject'
import { PropertyOptions, RegisteredProperty, StringKeyMap, StringMap } from './types'
import {
    attemptToParseDate,
    attemptToParseNumber,
    camelToSnake,
    stringify,
} from './utils/formatters'
import { UpsertComps } from './types'
import { BOOLEAN, isDate, isObject, NUMBER, DATE } from './utils/propertyTypes'

class Properties {
    protected registry: { [key: string]: RegisteredProperty }

    protected columnToPropertyName: StringMap = {}

    protected propertyToColumnName: StringMap = {}

    uniqueBy: string[]

    snapshot: StringKeyMap = {}

    get uniqueByColumnNames(): string[] {
        return this.uniqueBy.map((propertyName) => this.toColumnName(propertyName) as string)
    }

    constructor(registry: { [key: string]: RegisteredProperty }, uniqueBy: string | string[]) {
        this.registry = registry
        this._buildPropertyColumnNameMappings()

        this.uniqueBy = Array.isArray(uniqueBy) ? uniqueBy : [uniqueBy]
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

    getLoadFilters(liveObject: LiveObject): StringKeyMap {
        const filters = {}
        for (const propertyName of this.uniqueBy) {
            const value = liveObject[propertyName]
            if (value === undefined) {
                throw `Live object is missing required unique property "${propertyName}" in order to load.`
            }
            filters[this.toColumnName(propertyName) as string] = value
        }
        return filters
    }

    getUpsertComps(liveObject: LiveObject): UpsertComps {
        // Get a map of the properties that currently hold values.
        const propertyData = this.withValues(liveObject)

        // Validate all unique constraint properties have values.
        for (const propertyName of this.uniqueBy) {
            if (!propertyData.hasOwnProperty(propertyName)) {
                throw `Live object is missing required unique property "${propertyName}" in order to save.`
            }
        }

        // Get the list of the property names to update on conflict.
        const updatePropertyNames: string[] = []
        for (const propertyName in propertyData) {
            const update = !this.isUnique(propertyName) && this.canUpdate(propertyName)
            update && updatePropertyNames.push(propertyName)
        }

        // Build "INSERT (...) ON CONFLICT (...) DO UPDATE SET (...)" components.
        return {
            insertData: this.toRecord(propertyData),
            conflictColumns: this.uniqueByColumnNames,
            updateColumns: updatePropertyNames.map((p) => this.toColumnName(p) as string),
        }
    }

    capture(liveObject: LiveObject) {
        const snapshot = {}
        for (const propertyName in this.registry) {
            snapshot[propertyName] = liveObject[propertyName]
        }
        this.snapshot = snapshot
    }

    haveChanged(liveObject: LiveObject) {
        if (!Object.keys(this.snapshot).length) return true

        for (const propertyName in this.registry) {
            if (liveObject[propertyName] !== this.snapshot[propertyName]) {
                return true
            }
        }
        return false
    }

    withValues(liveObject: LiveObject): StringKeyMap {
        const withValues = {}
        for (const propertyName in this.registry) {
            const value = liveObject[propertyName]
            if (value === undefined) continue
            withValues[propertyName] = value
        }
        return withValues
    }

    toRecord(propertyData: StringKeyMap): StringKeyMap {
        const columnData = {}
        for (const propertyName in propertyData) {
            const columnName = this.toColumnName(propertyName)
            if (!columnName) continue
            columnData[columnName] = this.toColumnType(
                propertyData[propertyName],
                this.registry[propertyName].metadata?.name?.toLowerCase()
            )
        }
        return columnData
    }

    fromRecord(record: StringKeyMap): StringKeyMap {
        const propertyData = {}
        for (const columnName in record) {
            const propertyName = this.fromColumnName(columnName)
            if (!propertyName) continue
            propertyData[propertyName] = this.toColumnType(
                record[columnName],
                this.registry[propertyName].metadata?.name?.toLowerCase()
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

    toColumnType(value: any, metaType: string | null) {
        if (value === null) return null
        if (isDate(value)) return value.toISOString()
        if (metaType === NUMBER) return attemptToParseNumber(value)
        if (metaType === BOOLEAN) return Boolean(value)
        if (isObject(value)) return stringify(value)
        return value
    }

    fromColumnType(value: any, metaType: string | null) {
        if (value === null) return null
        if (metaType === DATE) return attemptToParseDate(value)
        if (metaType === NUMBER) return attemptToParseNumber(value)
        if (metaType === BOOLEAN) return Boolean(value)
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

    isUnique(name: string): boolean {
        return this.uniqueBy.includes(name)
    }

    canUpdate(name: string): boolean {
        const options = this.options(name)
        if (!options) return false
        return options.update !== false
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
