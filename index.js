const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

async function getItems(page, url) {
  await page.goto(url);
  await page.waitForSelector('.Z_list-box');
  const items = await page.evaluate(() => {
    const results = [];
    
    // 获取所有房源项
    const itemElements = document.querySelectorAll('.Z_list-box .item[data-inv-no]');
    
    itemElements.forEach(item => {
      // 提取基本信息
      const invNo = item.getAttribute('data-inv-no');
      const bedroom = item.getAttribute('data-bedroom');
      const houseType = item.getAttribute('data-house-type');
      
      // 提取标题
      const titleElement = item.querySelector('.title');
      const title = titleElement ? titleElement.textContent.trim() : '';
      
      // 提取描述信息
      const descElements = item.querySelectorAll('.desc > div');
      const area = descElements[0] ? descElements[0].textContent.trim() : '';
      const location = descElements[1] ? descElements[1].textContent.trim() : '';
      
      // 提取标签
      const tags = [];
      const tagElements = item.querySelectorAll('.tag span');
      tagElements.forEach(tag => {
        tags.push(tag.textContent.trim());
      });
      
      const imgElement = item.querySelector('.pic-wrap img');
      const imgUrl = imgElement ? imgElement.getAttribute('src') : '';
      
      const linkElement = item.querySelector('.pic-wrap');
      const detailUrl = linkElement ? linkElement.getAttribute('href') : '';
      
      results.push({
        invNo,
        bedroom,
        houseType,
        title,
        area,
        location,
        tags: tags.join(' '),
        imgUrl,
        detailUrl: detailUrl ? `https:${detailUrl}` : ''
      });
    });
    
    return results;
  });
  const nextPageUrl = await page.$eval('a.next', link => link?.href).catch(() => null);
  return {
    items,
    nextPageUrl
  }
}

(async () => {
  /**
   * @type {import('puppeteer-core').Browser}
   */
  const browser = await puppeteer.launch({
    channel: 'chrome',
    headless: false
  });
  const page = await browser.newPage();
  const res = [];

  let nextPageUrl = 'https://cd.ziroom.com/z/z1-u10-r0-p1-q1104450762960740353-a1104450762960740353/?p=x14&cp=0TO1100';

  while (nextPageUrl) {
    const r = await getItems(page, nextPageUrl);
    nextPageUrl = r.nextPageUrl
    res.push(...r.items);
  }
  
  await browser.close();
})();
