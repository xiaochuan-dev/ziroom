const { DatabaseSync } = require("node:sqlite");
const database = new DatabaseSync("./data.db");

function getBeijingTime() {
  const now = new Date();
  const beijingOffset = 8 * 60 * 60 * 1000; // UTC+8
  const beijingTime = new Date(now.getTime() + beijingOffset);
  return beijingTime.toISOString().replace("T", " ").substring(0, 19);
}

function isExist(invNo) {
  const query = database.prepare("SELECT * FROM rooms WHERE invNo=?");

  const res = query.all(invNo);
  return !!res.length;
}

function insert(item) {
  const insert = database.prepare(`INSERT INTO rooms (
    invNo, bedroom, houseType, title, area, location, tags, imgUrl, detailUrl, update_at, price
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  insert.run(
    item.invNo, // 房源编号 (TEXT)
    item.bedroom, // 卧室数量 (TEXT)
    item.houseType, // 房屋类型 (TEXT)
    item.title, // 标题 (TEXT)
    item.area, // 面积信息 (TEXT)
    item.location, // 位置信息 (TEXT)
    item.tags, // 标签 (TEXT)
    item.imgUrl, // 图片URL (TEXT)
    item.detailUrl, // 详情页URL (TEXT)
    getBeijingTime(),
    item.price
  );
}

function getCurPriceAndUpdateAtAndChanges(invNo) {
  const query = database.prepare(
    "SELECT price, update_at, changes FROM rooms WHERE invNo=?"
  );
  const res = query.get(invNo);
  return res;
}

function update({ invNo, update_at, changes, newPrice }) {
  const updateQuery = database.prepare(
    "UPDATE rooms SET price=?, update_at=?, changes=? WHERE invNo=?"
  );
  updateQuery.run(newPrice, update_at, changes, invNo);
}

module.exports = {
  getBeijingTime,
  isExist,
  insert,
  update,
  getCurPriceAndUpdateAt
};
