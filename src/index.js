const puppeteer = require("puppeteer");
const axios = require("axios");
const cheerio = require("cheerio");
const url = require("url");
const fs = require("fs");
const path = require("path");
const config = require("../config");
const urlStack = [];

const entryInfo = url.parse(config.siteRoot);
const siteRootPath = path.join(__dirname, "../", config.root, entryInfo.host);

// 开始爬取
config.entryURL.map(url => loadURL(config.siteRoot + url));

async function loadURL(url) {
  if (
    fs.existsSync(parseURL(url)[0]) &&
    urlStack.findIndex(u => url === u) > -1
  ) {
    return;
  }
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    config.userAgent && (await page.setUserAgent(config.userAgent));
    config.cookies && (await page.setCookie(...config.cookies));
    await page.goto(url);
    urlStack.push(url);
    console.log("loadURL done,", url);
    const html = await page.content();
    browser.close();

    await writeFile(url, html);

    const $ = cheerio.load(html);

    getResource($, url, "script", "src");
    getResource($, url, "link", "href");
    getResource($, url, "img", "src");

    //顺着a链接继续爬
    $("a").each(async (i, aTag) => {
      loadURL(parseURL(url, aTag.attribs.href)[1]);
    });
  } catch (error) {
    console.error(error);
  }
}

/**
 * 写一个文件
 * location 是一个url
 *
 * @param {string} location
 * @param {string} content
 */
async function writeFile(location, content) {
  // 去掉 query 部分
  location = location.split("?")[0];
  let filePath;
  if (/^http/.test(location)) {
    filePath = parseURL(location)[0];
  } else {
    filePath = path.resolve(siteRootPath, location);
  }
  fs.mkdirSync(siteRootPath, { recursive: true });
  const { dir, base } = path.parse(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content.replace(/\.aspx/g, ".html"));
  console.log(`write file done. \n remote: ${location} \n local: ${filePath}.`);
  if (location.match(/\.css/)) {
    // FIXME: 这里截取资源路径的正则还是有点不正确，匹配的范围会有点大
    (content.match(/(\.|\/|\.\.)\/.*?\.[a-z A-Z]+/g) || []).map(img => {
      download(parseURL(location, img)[1]);
    });
  }
}

/**
 * 下载资源
 *
 * @param {string} url 资源url
 */
async function download(url) {
  if (url.match(/\.(jpg|png|jpeg|gif)/)) {
    downloadImage(url);
  } else {
    axios
      .get(url)
      .then(res => {
        writeFile(url, res.data);
      })
      .catch(httpErrorHandler);
  }
}

/**
 * 解析标签得到地址进行下载
 *
 * @param {*} source cheerio load html 得到的对象
 * @param {*} url 当前文件的 url
 * @param {*} tag 需要获取的标签名字
 * @param {*} propName 对应标签包含资源的属性名称
 */
function getResource(source, url, tag, propName) {
  source(tag).each(async (i, v) => {
    const value = v.attribs[propName];
    if (value && !/^http/.test(value)) download(parseURL(url, value)[1]);
  });
}

/**
 * 下载图片这种二进制文件
 *
 * @param {string} url 图片url
 * @returns {promise}
 */
async function downloadImage(url) {
  const _path = parseURL(url)[0];
  await writeFile(_path, "");
  const writer = fs.createWriteStream(_path);
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream"
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        resolve();
      });
      writer.on("error", () => {
        reject();
      });
    });
  } catch (error) {
    httpErrorHandler(error);
  }
}

/**
 * 把url转换成本地保存的路径
 *
 * @param {string} base url
 * @param {string} target 相对路径
 * @returns {array}
 */
function parseURL(base, target) {
  let _url = base;
  let { path: pa, host, protocol } = url.parse(base);
  let filePath = path.join(siteRootPath, pa);
  if (target) {
    let { dir } = path.parse(filePath);
    filePath = path.resolve(dir, target);
    let { dir: _urlDir } = path.parse(pa);
    pa = path.join(_urlDir, target);
    _url = protocol + "//" + host + pa.replace(/\\/g, "/");
  }
  return [filePath.replace(/\.aspx/g, ".html"), _url];
}

function httpErrorHandler({ response }) {
  if (response.status >= 400) {
    console.log(
      `资源获取失败. \n http-status-code: ${response.status} \n url: ${
        response.config.url
      }`
    );
  }
}
