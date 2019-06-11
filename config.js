const { AGENT } = require("./src/const");

module.exports = {
  userAgent: AGENT.MOBILE,
  root: "./all-sites",
  siteRoot: "http://www.12337.gov.cn/mobileweb/",
  entryURL: ["Defaultmobile.aspx", "index.aspx"]
};
