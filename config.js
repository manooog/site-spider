const { AGENT } = require("./src/const");

module.exports = {
  userAgent: AGENT.MOBILE,
  root: "./all-sites",
  siteRoot: "http://www.12337.gov.cn/mobileweb/",
  entryURL: ["Defaultmobile.aspx"],
  cookies: [
    {
      domain: "www.12337.gov.cn",
      hostOnly: true,
      httpOnly: true,
      name: "ASP.NET_SessionId",
      path: "/",
      sameSite: "no_restriction",
      secure: false,
      session: true,
      storeId: "0",
      value: "h4nooprl555a5sofcyhx12nu",
      id: 1
    }
  ]
};
