import { defaultAbiCoder, ParamType } from '@ethersproject/abi'
import { BytesLike } from './bytes'
import { BigNumber as BigInt } from './bignumber'

export const encodeAbi = (
    values: ReadonlyArray<any>,
    types: ReadonlyArray<string | ParamType>
): string => {
    return defaultAbiCoder.encode(values, types)
}

export const decodeAbi = (
    data: BytesLike,
    types: ReadonlyArray<string | ParamType>,
    loose?: boolean
): any[] => {
    const result = defaultAbiCoder.decode(types, data, loose).concat()
    typeConvert(result)
    return result
}

function typeConvert(arr: any[]) {
    for (let i = 0; i < arr.length; i++) {
        if (Array.isArray(arr[i])) {
            typeConvert(arr[i])
        } else if (arr[i] && typeof arr[i] === 'object' && arr[i]._isBigNumber) {
            arr[i] = BigInt.from(arr[i])
        }
    }
}
