/**
*  @filename    ItemDB.js
*  @desc        function to add/update items into database
*  @thankYou    Richard for inspiring me,
*               Gagget for all SQLite explains,
*               Adhd for password find function.
*  @version     2021/01/30
*/

includeIfNotIncluded("systems/mulelogger/MuleLogger.js");
const Overrides = require("../../modules/Override");

new Overrides.Override(MuleLogger, MuleLogger.logChar, function (original, ...args) {
  while (!me.gameReady) {
    delay(3);
  }

  while (!ItemDB.init(false)) {
    delay(1000);
  }

  original.apply(this, args);
}).apply();

const ItemDB = {
  skipEquiped: true, // skip equipped items in logging
  mulePass: "", // default password if its not found anywhere else
  
  // DON'T TOUCH
  DB: "databases/ItemDB.s3db",
  logFile: "databases/ItemDB.log",
  query: "",
  DBConnect: 0,
  ID: {},
  tick: 0,
  count: 0,
  single: [],
  
  DBTblAccs:	"muleAccounts (accountRealm, accountLogin, accountPasswd)",
  DBTblChars:	"muleChars (charAccountId, charName, charExpansion, charHardcore, charLadder, charClassId)",
  DBTblItems:	"muleItems (itemCharId, itemName, itemType, itemClass, itemClassid, itemQuality, itemFlag, itemColor, itemImage, itemMD5, itemDescription, itemLocation, itemX, itemY)",
  DBTblStats:	"muleItemsStats (statsItemId, statsName, statsValue)",
  
  realms: { "uswest": 0, "useast": 1, "asia": 2, "europe": 3 },
  
  timeStamp: function () {
    let date = new Date();
    let h = date.getHours();
    let m = date.getMinutes();
    let s = date.getSeconds();
    let year = date.getFullYear();
    let mo = date.getMonth() + 1;
    let d = date.getDate();
    return (
      "[" + year + "."
      + (mo < 10 ? "0" + mo : mo)
      + "." + (d < 10 ? "0" + d : d)
      + " " + (h < 10 ? "0" + h : h)
      + ":" + (m < 10 ? "0" + m : m)
      + ":" + (s < 10 ? "0" + s : s) + "] "
    );
  },
  
  log: function (data) {
    let timestamp = ItemDB.timeStamp();
    FileAction.append(this.logFile, timestamp + " - [ profile: \"" + me.profile + "\" account: \"" + me.account + "\" char: \"" + me.name + "\" ] " + data + "\n");
  },
  
  init: function (drop) {
    let success = true;
    if (this.createDB()) {
      print("ItemDB :: New database created!");
    }
    try {
      if (!drop) {
        print("ItemDB :: Starting database connection");
      }
      
      this.tick = getTickCount();
      
      // init db connection and open it. this is our handler now.
      this.DBConnect = new SQLite(this.DB, true);
      this.DBConnect.execute("BEGIN TRANSACTION;");
      this.ID.acc = this.insertAccs(!drop);
      this.ID.chara	= this.insertChar();
      this.logItems(drop);
      this.DBConnect.execute("COMMIT;");
    } catch (e) {
      success = false;
      this.log(e);
    } finally {
      this.DBConnect.close();
    }
    
    if (!drop) {
      print("ItemDB :: Closing database connection after: " + ((getTickCount() - this.tick) / 1000).toFixed(2) + "s");
      this.log(this.count + " items logged in " + ((getTickCount() - this.tick) / 1000).toFixed(2) + "s");
    }
    
    return success;
  },
  
  deleteChar: function (a) {
    let success = true;
    try {
      this.DBConnect = new SQLite(this.DB, true);
      this.DBConnect.execute("BEGIN TRANSACTION;");
      this.DBConnect.execute("DELETE FROM muleChars WHERE charName = '" + a + "';");
      this.DBConnect.execute("COMMIT;");
    } catch (e) {
      success = false;
      this.log(e);
    } finally {
      this.DBConnect.close();
    }
    return success;
  },
  
  createDB: function () {
    let folder;
    let data = [
      "PRAGMA main.page_size=4096;",
      "PRAGMA main.cache_size=10000;",
      "PRAGMA main.locking_mode=EXCLUSIVE;",
      "PRAGMA main.synchronous=NORMAL;",
      "PRAGMA main.journal_mode=WAL;",
      "PRAGMA main.temp_store = MEMORY;",
      "CREATE TABLE IF NOT EXISTS [muleAccounts] ([accountId] INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT, [accountRealm] INTEGER  NULL, [accountLogin] VARCHAR(32)  NULL, [accountPasswd] VARCHAR(32)  NULL);",
      "CREATE TABLE IF NOT EXISTS [muleChars] ([charId] INTEGER  PRIMARY KEY AUTOINCREMENT NOT NULL, [charAccountId] INTEGER  NULL, [charName] VARCHAR(32)  NULL, [charExpansion] BOOLEAN  NULL, [charHardcore] BOOLEAN  NULL, [charLadder] BOOLEAN  NULL, [charClassId] INTEGER NULL);",
      "CREATE TABLE IF NOT EXISTS [muleItems] ([itemId] INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT, [itemCharId] INTEGER  NULL, [itemName] VARCHAR(64)  NULL, [itemType] INTEGER  NULL, [itemClass] INTEGER  NULL, [itemClassid] INTEGER  NULL, [itemQuality] INTEGER  NULL, [itemFlag] INTEGER  NULL, [itemColor] INTEGER  NULL, [itemImage] VARCHAR(8)  NULL, [itemMD5] VARCHAR(32)  NULL, [itemDescription] TEXT  NULL, [itemLocation] INTEGER  NULL, [itemX] INTEGER NULL, [itemY] INTEGER NULL);",
      "CREATE TABLE IF NOT EXISTS [muleItemsStats] ([statsItemId] INTEGER  NULL, [statsName] VARCHAR(50)  NULL, [statsValue] INTEGER  NULL);",
      "CREATE UNIQUE INDEX IF NOT EXISTS [IDX_MULEACCOUNTS_ACCOUNTID] ON [muleAccounts]([accountRealm]  ASC, [accountLogin]  ASC);",
      "CREATE UNIQUE INDEX IF NOT EXISTS [IDX_MULECHARS_CHARID] ON [muleChars]([charAccountId]  ASC, [charName]  ASC);",
      "CREATE UNIQUE INDEX IF NOT EXISTS [IDX_MULEITEMS_ITEMID] ON [muleItems]([itemId]  ASC, [itemCharId]  ASC);",
      "CREATE UNIQUE INDEX IF NOT EXISTS [IDX_MULEITEMSSTATS_STATSITEMID] ON [muleItemsStats]([statsItemId]  ASC,[statsName]  ASC);",
      "CREATE TRIGGER [ON_TBL_MULEACCOUNTS_DELETE] BEFORE DELETE ON [muleAccounts] FOR EACH ROW BEGIN DELETE FROM muleChars WHERE charAccountId = OLD.accountId; END;",
      "CREATE TRIGGER [ON_TBL_MULECHARS_DELETE] BEFORE DELETE ON [muleChars] FOR EACH ROW BEGIN DELETE FROM muleItems WHERE itemCharId = OLD.charId; END;",
      "CREATE TRIGGER [ON_TBL_MULEITEMS_DELETE] BEFORE DELETE ON [muleItems] FOR EACH ROW BEGIN DELETE FROM muleItemsStats WHERE statsItemId = OLD.itemId; END;"
    ];
    
    if (!FileTools.exists(this.DB)) {
      if (!FileTools.exists("databases")) {
        folder = dopen("");
        folder.create("databases");
      }
      this.DBConnect = new SQLite(this.DB, true);
      
      for (let i = 0; i < data.length; i++) {
        this.DBConnect.execute(data[i]);
      }
      
      this.DBConnect.close();
      
      return true;
    } else {
      return false;
    }
  },
  
  insertAccs: function (update) {
    let accID, accPW;
    // realm, account
    
    this.getPasswords();
    
    let handle = this.DBConnect.query("SELECT accountId, accountPasswd FROM muleAccounts WHERE accountLogin = '" + me.account.toLowerCase() + "' AND accountRealm = '" + this.realms[me.realm.toLowerCase()] + "';");
    handle.next();
    
    if (handle.ready) {
      accID = handle.getColumnValue(0);
      accPW = handle.getColumnValue(1);
    } else {
      while (!this.DBConnect.execute("INSERT into " + this.DBTblAccs + " values ('" + this.realms[me.realm.toLowerCase()] + "', '" + me.account.toLowerCase() + "', '" + this.mulePass + "');")) {
        delay(500);
      }
      accID = this.DBConnect.lastRowId;
      print("ItemDB :: Added account \"" + me.account + "\" into database with ID: " + accID);
    }
    
    if (!accPW && this.mulePass !== accPW && update) {
      while (!this.DBConnect.execute("UPDATE muleAccounts SET accountPasswd = '" + this.mulePass + "' WHERE accountId = " + accID + ";")) {
        delay(500);
      }
      this.log("Updated password for: \"" + me.account + "\" old: \"" + accPW + "\" new: \"" + this.mulePass + "\" ");
    }
    
    return accID;
  },
  
  insertChar: function () {
    let charID, charClass;
    // id, me.name, me.gametype, me.playertype, me.ladder, me.classid
    
    this.ID.exp =	me.gametype ? "1" : "0";
    this.ID.sc =	me.playertype ? "1" : "0";
    this.ID.lad =	me.ladder ? "1" : "0";
    this.ID.classId	=	me.classid;
    
    let handle = this.DBConnect.query("SELECT charId, charClassId FROM muleChars WHERE charAccountId = '" + this.ID.acc + "' AND charName = '" + me.name + "';");
    handle.next();
    
    if (handle.ready) {
      charID = handle.getColumnValue(0);
      charClass	= handle.getColumnValue(1);
      
      while (!this.DBConnect.execute("UPDATE muleChars SET charClassId = " + this.ID.classId + " WHERE charId = " + charID + ";")) {
        delay(500);
      }
      
    } else {
      while (!this.DBConnect.execute("INSERT INTO " + this.DBTblChars + " VALUES ('" + this.ID.acc + "', '" + me.name + "', '" + this.ID.exp + "', '" + this.ID.sc + "', '" + this.ID.lad + "', '" + this.ID.classId + "');")) {
        delay(500);
      }
      charID = this.DBConnect.lastRowId;
      print("ItemDB :: added character \"" + me.name + "\" into database with ID: " + charID);
    }
    
    return charID;
  },
  
  logItems: function (dd) {
    let items;
    
    if (dd) {
      let handle, itemid, dropitam;
      // id, me.name, me.gametype, me.playertype, me.ladder
      
      if (typeof dd === "string") {
        dd = [dd];
      }
      
      for (let i = 0; i < dd.length; i++) {
        handle = this.DBConnect.query("SELECT itemId,itemName FROM muleItems LEFT JOIN muleChars ON itemCharId = charId WHERE charAccountId = '" + this.ID.acc + "' AND charName = '" + me.name + "' AND itemMD5 = '" + dd[i] + "' LIMIT 1;");
        handle.next();
        
        if (handle.ready) {
          itemid = handle.getColumnValue(0);
          dropitam = handle.getColumnValue(1);
        }

        if (typeof itemid != "number") {
          this.log("RELOG CHARACTER - DATA CORRUPTED");
          return false;
        }
        
        this.DBConnect.execute("DELETE FROM muleItems WHERE itemId = " + itemid + ";");
        
        this.log("dropped " + dropitam + " in " + me.gamename + "//" + me.gamepassword);
      }
      print("ItemDB :: removed " + dd.length + " items from database.");
      return true;
    }
    // remove items from DB with your charID to avoid double entrys
    while (!this.DBConnect.execute("DELETE FROM muleItems WHERE itemCharId = " + this.ID.chara + ";")) {
      delay(500);
    }
    
    
    //list of our items
    items = me.getItems();
    
    for (let i = 0; i < items.length; i++) {
      if ([22, 76, 77, 78].indexOf(items[i].itemType) === -1) {	//skip scrools and potions
        if (items[i].mode === 1 && this.skipEquiped) {
          continue;
        }
        this.ID.item = this.insertItem(items[i]);
        this.insertStats(items[i]);
        this.count++;
      }
    }
    return true;
  
  },
  
  /** @param {ItemUnit} item */
  insertItem: function (item) {
    let itam = {}, itemID;
    //itemchar, itemname, itemtype, itemclass, itemclassid, itemquality, itemflag, itemcolor, itemimage, itemdesc
    itam.fname = this.safeStrings(item.fname.split("\n").reverse().join(" ").replace(/(y|ÿ)c[0-9!"+<;.*]/, "").trim());
    itam.flag = item.getFlags();
    itam.color = item.getColor();
    itam.image = Item.getItemCode(item);
    itam.MD5 = md5(item.description);
    itam.description = this.safeStrings(this.getItemDesc(item));
    
    while (!this.DBConnect.execute("INSERT INTO " + this.DBTblItems + " VALUES ('" + this.ID.chara + "', '" + itam.fname + "', '" + item.itemType + "', '" + item.itemclass + "', '" + item.classid + "', '" + item.quality + "', '" + itam.flag + "', '" + itam.color + "', '" + itam.image + "', '" + itam.MD5 + "', '" + itam.description + "', '" + item.location + "', '" + item.x + "', '" + item.y + "');")) {
      delay(500);
    }
    itemID = this.DBConnect.lastRowId;
    
    return itemID;
  },
  
  /** @param {ItemUnit} item */
  insertStats: function (item) {
    let stats = this.dumpItemStats(item);
    
    for (let a in stats) {
      while (!this.DBConnect.execute("INSERT INTO " + this.DBTblStats + " VALUES ('" + this.ID.item + "', '" + a + "', '" + stats[a] + "');")) {
        delay(500);
      }
    }
  },
  
  /** @param {ItemUnit} item */
  dumpItemStats: function (item) {	//ty kolton
    let val, i, n;
    let stats = item.getStat(-2);
    let dump = {};

    for (i = 0; i < stats.length; i += 1) {
      if (stats[i]) {
        for (n in NTIPAliasStat) {
          if (NTIPAliasStat.hasOwnProperty(n)) {
            switch (typeof NTIPAliasStat[n]) {
            case "number":
              if (NTIPAliasStat[n] === i) {
                switch (NTIPAliasStat[n]) {
                case 20: // toblock
                case 21: // mindamage
                case 22: // maxdamage
                case 23: // secondarymindamage
                case 24: // secondarymaxdamage
                case 31: // defense
                case 83: // itemaddclassskills
                case 188: // itemaddskilltab
                case 159: // itemthrowmindamage
                case 160: // itemthrowmaxdamage
                  val = item.getStatEx(NTIPAliasStat[n]);

                  if (val) {
                    dump[n] = val;
                  }

                  break;
                // poison damage stuff
                case 57: // poisonmindam
                case 58: // poisonmaxdam
                case 59: // poisonlength
                case 326: // poisoncount
                  if (!dump.hasOwnProperty("poisondamage")) {
                    val = item.getStatEx(57, 1);

                    if (val) {
                      dump.poisondamage = val;
                    }
                  }

                  break;
                case 195:
                case 198:
                case 204:
                  if (stats[i]) {
                    dump[n] = stats[i].skill;
                  }

                  break;
                default:
                  if (stats[i][0]) {
                    dump[n] = stats[i][0];
                  }

                  break;
                }
              }

              break;
            case "object":
              val = item.getStatEx(NTIPAliasStat[n][0], NTIPAliasStat[n][1]);
              if (val) {
                dump[n] = val;
              }
              break;
            }
          }
        }
      }
    }

    return dump;
  },
  
  /** @param {string} string */
  safeStrings: function (string) {
    string = string.replace(/[\0\n\r\b\t\\'"\x1a]/g, function (s) {
      switch (s) {
      case "\0":
        return "\\0";
      case "\n":
        return "\\n";
      case "\r":
        return "\\r";
      case "\b":
        return "\\b";
      case "\t":
        return "\\t";
      case "\x1a":
        return "\\Z";
      case "'":
        return "''";
      case '"':
        return '""';
      default:
        return "\\" + s;
      }
    });
    
    return string;
  },
  
  /** @param {ItemUnit} unit */
  getItemDesc: function (unit) {
    let i, desc;
    let stringColor = "<span class='color0'>";

    desc = unit.description;

    if (!desc) {
      return "";
    }

    desc = desc.split("\n");

    // Lines are normally in reverse. Add color tags if needed and reverse order.
    for (i = 0; i < desc.length; i += 1) {
      if (desc[i].indexOf(getLocaleString(3331)) > -1) { // Remove sell value
        desc.splice(i, 1);

        i -= 1;
      } else {
        if (desc[i].match(/^(y|ÿ)c/)) {
          stringColor = desc[i].substring(0, 3);
        } else {
          desc[i] = stringColor + desc[i];
        }
      }

      desc[i] = desc[i].replace(/(y|ÿ)c([0-9!"+<;.*])/g, "<span class='color$2'>");
      desc[i] = desc[i] + "</span>";
      if (stringColor == "<span class='color0'>") {	//What a dirty solution O.o
        desc[i] = desc[i] + "</span>";
      }
      
    }

    if (desc[desc.length - 1]) {
      desc[desc.length - 1] = desc[desc.length - 1].trim() + " (" + unit.ilvl + ")";
    }

    desc = desc.reverse().join("<BR>");

    return desc;
  },

  getPasswords: function () {	//ty Adhd
    includeIfNotIncluded("systems/dropper/DropperSetup.js");

    for (let i in DropperAccounts) {
      if (DropperAccounts.hasOwnProperty(i) && typeof i === "string") {
        for (let j in DropperAccounts[i]) {
          if (DropperAccounts[i].hasOwnProperty(j) && typeof j === "string") {
            if (j.split("/")[0].toLowerCase() === me.account.toLowerCase()) {
              ItemDB.mulePass = j.split("/")[1];

              return true;
            }
          }
        }
      }
    }

    includeIfNotIncluded("systems/mulelogger/MuleLogger.js");

    for (let i in MuleLogger.LogAccounts) {
      if (MuleLogger.LogAccounts.hasOwnProperty(i) && typeof i === "string") {
        if (i.split("/")[0].toLowerCase() === me.account.toLowerCase()) {
          ItemDB.mulePass = i.split("/")[1];

          return true;
        }
      }
    }

    includeIfNotIncluded("systems/automule/AutoMule.js");
    
    for (let i in AutoMule.Mules) {
      if (AutoMule.Mules[i].accountPrefix) {
        if (me.account.toLowerCase().match(AutoMule.Mules[i].accountPrefix.toLowerCase())) {
          ItemDB.mulePass = AutoMule.Mules[i].accountPassword;

          return true;
        }
      }
    }
    
    for (let i in AutoMule.TorchAnniMules) {
      if (AutoMule.TorchAnniMules[i].accountPrefix) {
        if (me.account.toLowerCase().match(AutoMule.TorchAnniMules[i].accountPrefix.toLowerCase())) {
          ItemDB.mulePass = AutoMule.TorchAnniMules[i].accountPassword;

          return true;
        }
      }
    }
    
    return false;
  },
  
  /** @param {{ charName: string }} obj */
  deleteCharacter: function (obj) {
    let success = true;
    try {
      print("ItemDB :: Starting database connection");
      
      this.tick = getTickCount();
      
      //init db connection and open it. this is our handler now.	
      this.DBConnect = new SQLite(this.DB, true);
      this.DBConnect.execute("BEGIN TRANSACTION;");
      this.DBConnect.execute("DELETE FROM muleChars WHERE charName = '" + obj.charName + "';");
      this.DBConnect.execute("COMMIT;");
      
      print("ItemDB :: Starting database connection");
    } catch (e) {
      success = false;
      this.log(e);
    } finally {
      this.DBConnect.close();
    }
    
    return success;
  }
};

