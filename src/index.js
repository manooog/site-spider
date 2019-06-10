const puppeteer = require("puppeteer");
const axios = require("axios");
const cheerio = require("cheerio");
const url = require("url");
const fs = require("fs");
const path = require("path");
const { AGENT } = require("./const");

console.log(path.resolve(__dirname, "css", "../images/lsls"));

const config = {
  userAgent: AGENT.MOBILE,
  root: path.resolve(__dirname, "../../root"),
  entryURL: "http://www.12337.gov.cn/mobileweb"
};

const entryInfo = url.parse(config.entryURL);
const siteRootPath = config.root + "/" + entryInfo.host;

loadURL(config.entryURL);

async function loadURL(url) {
  console.time("loadURL");
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setUserAgent(config.userAgent);
    await page.goto(url);
    const html = await page.$eval("html", e => e.outerHTML);
    let location = url.match(/\.(html|aspx)$/)
      ? "." +
        page
          .url()
          .replace(config.entryURL, "")
          .replace(/\.[a-z]+/, ".html")
      : "./index.html";
    await writeFile(location, html);
    console.log("loadURL done,", url);

    const $ = cheerio.load(html);

    getResource($, "script", "src");
    getResource($, "link", "href");
    getResource($, "img", "src");

    //顺着a链接继续爬
    $("a").each(async (i, aTag) => {
      loadURL(config.entryURL + "/" + constructURL(aTag.attribs.href));
    });

    browser.close();
  } catch (error) {
    console.error(error);
  }
  console.timeEnd("loadURL");
}

async function writeFile(location, content) {
  fs.mkdirSync(siteRootPath, { recursive: true });
  const filePath = path.resolve(siteRootPath, location);
  const { dir, base } = path.parse(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`write file done ${location}`);
  if (location.match(/\.css/)) {
    content
      .match(/url\((.*?)\)/g)
      .map(str => str.replace(/(url\()(.*?)(\))/, "$2"))
      .filter(v => {
        return !/^('|")data/.test(v);
      })
      .map(img => download(constructURL("css", img)));
  }
}

/**
 *
 *
 * @param {string} location
 */
async function download(location) {
  const url = config.entryURL + "/" + constructURL(location);
  if (location.match(/\.(jpg|png|jpeg|gif)/)) {
    downloadImage(url, location);
  } else {
    axios
      .get(url)
      .then(res => {
        writeFile(location, res.data);
      })
      .catch(err => console.log(err));
  }
}

function getResource(source, tag, propName) {
  source(tag).each(async (i, v) => {
    const value = v.attribs[propName];
    if (value) download(value);
  });
}

async function downloadImage(url, location) {
  const _path = path.resolve(siteRootPath, location);
  await writeFile(_path, "");
  const writer = fs.createWriteStream(_path);
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
    writer.on("error", reject);
  });
}

function constructURL(...location) {
  return path
    .resolve("/", ...location)
    .replace(path.resolve("/"), "")
    .replace(/\\/g, "/");
}
