const puppeteer = require("puppeteer");
const axios = require("axios");
const cheerio = require("cheerio");
const url = require("url");
const fs = require("fs");
const path = require("path");
const { AGENT } = require("./const");

const config = {
  userAgent: AGENT.MOBILE,
  root: path.resolve(__dirname, "../../root"),
  entryURL: [
    "http://www.12337.gov.cn/mobileweb/Defaultmobile.aspx",
    "http://www.12337.gov.cn/mobileweb/index.aspx"
  ]
};

const entryInfo = url.parse(config.entryURL[0]);
const siteRootPath = path.join(config.root, entryInfo.host);

config.entryURL.map(url => loadURL(url));

async function loadURL(url) {
  console.time(`loadURL:${url}`);
  if (fs.existsSync(parseURL(url)[0])) {
    console.log("url 已存在");
    return;
  }
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setUserAgent(config.userAgent);
    await page.goto(url);
    const html = await page.$eval("html", e => e.outerHTML);
    browser.close();

    await writeFile(url, html);
    console.log("loadURL done,", url);

    const $ = cheerio.load(html);

    getResource($, url, "script", "src");
    getResource($, url, "link", "href");
    getResource($, url, "img", "src");

    //顺着a链接继续爬
    $("a").each(async (i, aTag) => {
      loadURL(parseURL(url, aTag.attribs.href)[1]);
    });
  } catch (error) {
    // console.error(error);
  }
  console.timeEnd(`loadURL:${url}`);
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
  console.log(`write file done ${location}`);
  if (location.match(/\.css/)) {
    content
      .match(/url\((.*?)\)/g)
      .map(str => str.replace(/(url\()('|")?(.*?)('|")?(\))/, "$3"))
      .filter(v => {
        return !/^data/.test(v);
      })
      .map(img => {
        download(parseURL(location, img)[1]);
      });
  }
}

/**
 *
 *
 * @param {string} location
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
      .catch(err => {
        debugger;
      });
  }
}

function getResource(source, url, tag, propName) {
  source(tag).each(async (i, v) => {
    const value = v.attribs[propName];
    if (value && !/^http/.test(value)) download(parseURL(url, value)[1]);
  });
}

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
        debugger;
        reject();
      });
    });
  } catch (error) {
    // debugger
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
    _url = protocol + "//" + host + pa;
  }
  // debugger;
  return [filePath.replace(/\.aspx/g, ".html"), _url];
}
