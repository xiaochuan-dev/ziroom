const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const {
  isExist,
  insert,
  update,
  getCurPriceAndUpdateAt,
  getBeijingTime,
} = require("./db");
const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");

// 创建保存图片的目录
const outputDir = "room_prices";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

puppeteer.use(StealthPlugin());

async function getItems(page, url) {
  await page.goto(url);
  await page.waitForSelector(".Z_list-box");

  await page.evaluate(() => {
    const elementsToRemove = document.querySelectorAll(".unit, .rmb");
    elementsToRemove.forEach((element) => {
      element.remove();
    });
  });

  const itemElements = await page.$$(".Z_list-box .item[data-inv-no]");
  const items = [];

  for (let i = 0; i < itemElements.length; i++) {
    const item = itemElements[i];

    // 在浏览器环境中提取数据
    const itemData = await page.evaluate((el) => {
      const invNo = el.getAttribute("data-inv-no");
      const bedroom = el.getAttribute("data-bedroom");
      const houseType = el.getAttribute("data-house-type");

      const titleElement = el.querySelector(".title");
      const title = titleElement ? titleElement.textContent.trim() : "";

      const descElements = el.querySelectorAll(".desc > div");
      const area = descElements[0] ? descElements[0].textContent.trim() : "";
      const location = descElements[1]
        ? descElements[1].textContent.trim()
        : "";

      const tags = [];
      const tagElements = el.querySelectorAll(".tag span");
      tagElements.forEach((tag) => {
        tags.push(tag.textContent.trim());
      });

      const imgElement = el.querySelector(".pic-wrap img");
      const imgUrl = imgElement ? imgElement.getAttribute("src") : "";

      const linkElement = el.querySelector(".pic-wrap");
      const detailUrl = linkElement ? linkElement.getAttribute("href") : "";

      return {
        invNo,
        bedroom,
        houseType,
        title,
        area,
        location,
        tags: tags.join(" "),
        imgUrl,
        detailUrl: detailUrl ? `https:${detailUrl}` : "",
      };
    }, item);

    const invNo = await item.evaluate((el) => el.getAttribute("data-inv-no"));
    const roomDir = path.join(outputDir, invNo);
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir);
    }
    try {
      const priceElement = await item.$(".price");
      if (priceElement) {
        const priceImagePath = path.join(roomDir, `price_${i}.png`);
        await priceElement.screenshot({ path: priceImagePath });
        const {
          data: { text },
        } = await Tesseract.recognize(
          priceImagePath,
          "eng", // 中文和英文
          {
            tessedit_char_whitelist: "0123456789", // 限制字符集提高识别率
            tessedit_pageseg_mode: 7, // 单行文本模式
          }
        );

        // 清理识别结果
        const cleanedPrice = text.replace(/[^\d¥￥.]/g, "").trim();
        itemData.price = cleanedPrice;
      }
    } catch (error) {
      console.error(`处理房源 ${invNo} 时出错:`, error);
    }
    items.push(itemData);
  }

  const nextPageUrl = await page
    .$eval("a.next", (link) => link?.href)
    .catch(() => null);

  return {
    items,
    nextPageUrl,
  };
}

(async () => {
  /**
   * @type {import('puppeteer-core').Browser}
   */
  const browser = await puppeteer.launch({
    channel: "chrome",
    // headless: false
  });
  const page = await browser.newPage();
  const res = [];

  let nextPageUrl =
    "https://cd.ziroom.com/z/z1-u10-r0-p1-q1104450762960740353-a1104450762960740353/?p=x14&cp=0TO1100";

  while (nextPageUrl) {
    const r = await getItems(page, nextPageUrl);
    nextPageUrl = r.nextPageUrl;
    res.push(...r.items);
  }

  await browser.close();

  for (const item of res) {
    if (!isExist(item.invNo)) {
      console.log("新上线----------------");
      console.log(JSON.stringify(item));
      insert(item);
    } else {
      const { price, update_at, changes } = getCurPriceAndUpdateAt(item.invNo);
      if (price !== item.price) {
        const newUpdateAt = getBeijingTime();
        const newChanges = `${changes ?? ""}
        ${update_at}    ${item.price}`;
        update({
          invNo: item.invNo,
          newPrice: item.price,
          update_at: newUpdateAt,
          changes: newChanges,
        });
        console.log(`${item.invNo}  价格更新 ${item.price}`);
      }
    }
  }
})();
