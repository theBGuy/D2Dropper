declare global {
  namespace ItemDB {
    let skipEquiped: boolean;
    let mulePass: string;
    const DB: string;
    const logFile: string;
    let query: string;
    let DBConnect: number;
    let ID: {
      acc?: number;
      chara?: number;
      exp?: string;
      sc?: string;
      lad?: string;
      classId?: number;
      item?: number;
    };
    let tick: number;
    let count: number;
    let single: any[];
    const DBTblAccs: string;
    const DBTblChars: string;
    const DBTblItems: string;
    const DBTblStats: string;
    const realms: {
      uswest: number;
      useast: number;
      asia: number;
      europe: number;
    };
    
    function timeStamp(): string;
    function log(data: string): void;
    function init(drop: boolean): boolean;
    function deleteChar(a: string): boolean;
    function createDB(): boolean;
    function insertAccs(update: boolean): number;
    function insertChar(): number;
    function logItems(dd?: string | string[]): boolean;
    function insertItem(item: ItemUnit): number;
    function insertStats(item: ItemUnit): void;
    function dumpItemStats(item: ItemUnit): any;
  }
}
export {};