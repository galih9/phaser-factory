export enum ItemType {
    RAW = "RAW",
    PROCESSED = "PROCESSED",
}

export interface Item {
    type: ItemType;
}

export interface ItemCounter {
    raw: number;
    processed: number;
}
